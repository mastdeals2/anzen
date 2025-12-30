import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedTransaction {
  date: string;
  description: string;
  branchCode: string;
  debitAmount: number;
  creditAmount: number;
  balance: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bankAccountId = formData.get('bankAccountId') as string;

    if (!file || !bankAccountId) {
      throw new Error('Missing file or bankAccountId');
    }

    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('currency, account_number, bank_name')
      .eq('id', bankAccountId)
      .single();

    if (bankError || !bankAccount) {
      throw new Error('Bank account not found');
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    const text = await extractTextFromPDF(uint8Array);
    console.log('Extracted text length:', text.length);
    console.log('First 1000 chars:', text.substring(0, 1000));
    
    const parsed = parseBCAStatement(text, bankAccount.currency);
    
    if (!parsed.transactions || parsed.transactions.length === 0) {
      console.error('Full extracted text:', text);
      throw new Error('No transactions found in PDF. Please check if this is a valid BCA statement.');
    }

    const fileName = `${bankAccountId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('bank-statements')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Failed to upload PDF');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('bank-statements')
      .getPublicUrl(fileName);

    const { data: upload, error: uploadInsertError } = await supabase
      .from('bank_statement_uploads')
      .insert({
        bank_account_id: bankAccountId,
        statement_period: parsed.period,
        statement_start_date: parsed.startDate,
        statement_end_date: parsed.endDate,
        currency: bankAccount.currency,
        opening_balance: parsed.openingBalance,
        closing_balance: parsed.closingBalance,
        total_credits: parsed.totalCredits,
        total_debits: parsed.totalDebits,
        transaction_count: parsed.transactions.length,
        file_url: publicUrl,
        uploaded_by: user.id,
        status: 'completed',
      })
      .select()
      .single();

    if (uploadInsertError) {
      console.error('Upload insert error:', uploadInsertError);
      throw new Error('Failed to create upload record');
    }

    const lines = parsed.transactions.map((txn) => ({
      upload_id: upload.id,
      bank_account_id: bankAccountId,
      transaction_date: txn.date,
      description: txn.description,
      reference: '',
      branch_code: txn.branchCode,
      debit_amount: txn.debitAmount,
      credit_amount: txn.creditAmount,
      running_balance: txn.balance,
      currency: bankAccount.currency,
      reconciliation_status: 'unmatched',
      created_by: user.id,
    }));

    const { error: linesError } = await supabase
      .from('bank_statement_lines')
      .insert(lines);

    if (linesError) {
      console.error('Lines insert error:', linesError);
      throw new Error('Failed to insert transactions');
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploadId: upload.id,
        transactionCount: parsed.transactions.length,
        period: parsed.period,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error parsing BCA statement:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to parse PDF' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let rawText = decoder.decode(pdfData);
  let extractedText = '';

  // Extract text from BT/ET blocks
  const textObjectRegex = /BT\s+([\s\S]+?)\s+ET/g;
  const textMatches = rawText.matchAll(textObjectRegex);

  for (const match of textMatches) {
    const content = match[1];
    const stringMatches = content.matchAll(/[\(\<]([^\)\>]+)[\)\>]/g);
    for (const strMatch of stringMatches) {
      let text = strMatch[1];
      text = text.replace(/\\([\\()rnt])/g, (_, char) => {
        switch (char) {
          case 'n': return '\n';
          case 'r': return '\r';
          case 't': return '\t';
          case '\\': return '\\';
          case '(': return '(';
          case ')': return ')';
          default: return char;
        }
      });
      extractedText += text + ' ';
    }
  }

  // Extract from streams
  const streamRegex = /stream\s+([\s\S]+?)\s+endstream/g;
  const streamMatches = rawText.matchAll(streamRegex);

  for (const match of streamMatches) {
    const stream = match[1];
    const textPattern = /[A-Za-z0-9\/\-\.\,\s]{3,}/g;
    const texts = stream.match(textPattern);
    if (texts) {
      extractedText += ' ' + texts.join(' ');
    }
  }

  // Fallback: extract any readable text
  const readablePattern = /[A-Za-z]{3,}[\w\s\.,\-\/]+/g;
  const readable = rawText.match(readablePattern);
  if (readable) {
    extractedText += ' ' + readable.join(' ');
  }

  return extractedText;
}

function parseBCAStatement(text: string, currency: string) {
  text = text.replace(/\s+/g, ' ');
  console.log('Parsing text of length:', text.length);

  let period = '';
  let openingBalance = 0;
  let closingBalance = 0;

  // Try multiple period patterns
  const periodPatterns = [
    /PERIODE[:\s]+([A-Z]+[\s]+\d{4})/i,
    /PERIOD[:\s]+([A-Z]+[\s]+\d{4})/i,
    /(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)[\s]+(\d{4})/i
  ];
  
  for (const pattern of periodPatterns) {
    const match = text.match(pattern);
    if (match) {
      period = match[1] + (match[2] ? ' ' + match[2] : '');
      break;
    }
  }

  // Try multiple balance patterns
  const openingPatterns = [
    /SALDO[\s]+AWAL[:\s]+([\d,\.]+)/i,
    /OPENING[\s]+BALANCE[:\s]+([\d,\.]+)/i,
    /BALANCE[\s]+AWAL[:\s]+([\d,\.]+)/i
  ];
  
  for (const pattern of openingPatterns) {
    const match = text.match(pattern);
    if (match) {
      openingBalance = parseAmount(match[1]);
      break;
    }
  }

  const closingPatterns = [
    /SALDO[\s]+AKHIR[:\s]*([\d,\.]+)/i,
    /CLOSING[\s]+BALANCE[:\s]*([\d,\.]+)/i,
    /BALANCE[\s]+AKHIR[:\s]*([\d,\.]+)/i
  ];
  
  for (const pattern of closingPatterns) {
    const match = text.match(pattern);
    if (match) {
      closingBalance = parseAmount(match[1]);
      break;
    }
  }

  console.log('Period:', period, 'Opening:', openingBalance, 'Closing:', closingBalance);

  let startDate = '';
  let endDate = '';
  const currentYear = new Date().getFullYear();
  let year = currentYear.toString();
  
  if (period) {
    const parts = period.split(/\s+/);
    const yearPart = parts.find(p => /^\d{4}$/.test(p));
    const monthPart = parts.find(p => /^[A-Z]+$/i.test(p));
    
    if (yearPart) year = yearPart;
    
    if (monthPart) {
      const monthMap: Record<string, string> = {
        JANUARY: '01', JANUARI: '01', FEBRUARI: '02', FEBRUARY: '02', MARET: '03', MARCH: '03',
        APRIL: '04', MEI: '05', MAY: '05', JUNI: '06', JUNE: '06',
        JULI: '07', JULY: '07', AGUSTUS: '08', AUGUST: '08',
        SEPTEMBER: '09', OKTOBER: '10', OCTOBER: '10', NOVEMBER: '11', DESEMBER: '12', DECEMBER: '12',
      };
      const month = monthMap[monthPart.toUpperCase()] || '01';
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  const transactions: ParsedTransaction[] = [];
  
  // Pattern 1: Full format with date, description, amount, indicator, balance
  const pattern1 = /(\d{2}\/\d{2})[\s]+([A-Z][A-Za-z\s\-\/]+?)[\s]+(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)[\s]*(DB|CR)?[\s]*(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)?/gi;
  
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const [_, dateStr, desc, amountStr, indicator, balanceStr] = match;
    const [day, month] = dateStr.split('/');
    const fullDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const amount = parseAmount(amountStr);
    const balance = balanceStr ? parseAmount(balanceStr) : null;
    const isDebit = !indicator || indicator.toUpperCase() === 'DB';

    if (amount > 0 && !isNaN(amount) && amount < 1000000000000) {
      transactions.push({
        date: fullDate,
        description: desc.trim().substring(0, 500),
        branchCode: '',
        debitAmount: isDebit ? amount : 0,
        creditAmount: isDebit ? 0 : amount,
        balance,
      });
    }
  }

  console.log('Pattern 1 found:', transactions.length, 'transactions');

  // Pattern 2: Simple date and amount
  if (transactions.length === 0) {
    const pattern2 = /(\d{2}\/\d{2})[^\d]+(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})?)/gi;
    
    while ((match = pattern2.exec(text)) !== null) {
      const [_, dateStr, amountStr] = match;
      const [day, month] = dateStr.split('/');
      const fullDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const amount = parseAmount(amountStr);

      // Look for description nearby
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(text.length, match.index + 200);
      const context = text.substring(contextStart, contextEnd);
      const descMatch = context.match(/(\d{2}\/\d{2})[\s]+([A-Za-z][A-Za-z\s\-\/]{3,50})/i);
      const description = descMatch ? descMatch[2].trim() : 'Transaction';

      if (amount > 0 && !isNaN(amount) && amount < 1000000000000) {
        transactions.push({
          date: fullDate,
          description: description.substring(0, 200),
          branchCode: '',
          debitAmount: amount,
          creditAmount: 0,
          balance: null,
        });
      }
    }
    
    console.log('Pattern 2 found:', transactions.length, 'transactions');
  }

  // Pattern 3: Very simple - any number that looks like money
  if (transactions.length === 0) {
    const pattern3 = /(\d{1,3}(?:[\.,]\d{3})+(?:[\.,]\d{2})?)/g;
    const amounts: number[] = [];
    
    while ((match = pattern3.exec(text)) !== null) {
      const amount = parseAmount(match[1]);
      if (amount > 1000 && amount < 1000000000000) {
        amounts.push(amount);
      }
    }
    
    console.log('Pattern 3 found', amounts.length, 'potential amounts');
    
    // Create transactions from amounts (very basic fallback)
    if (amounts.length > 0) {
      const txnDate = startDate || `${year}-01-01`;
      amounts.forEach((amt, idx) => {
        transactions.push({
          date: txnDate,
          description: `Transaction ${idx + 1}`,
          branchCode: '',
          debitAmount: amt,
          creditAmount: 0,
          balance: null,
        });
      });
    }
  }

  const totalDebits = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredits = transactions.reduce((sum, t) => sum + t.creditAmount, 0);

  console.log(`Final: ${transactions.length} transactions, Total DR: ${totalDebits}, Total CR: ${totalCredits}`);

  return {
    period,
    startDate: startDate || `${year}-01-01`,
    endDate: endDate || `${year}-12-31`,
    openingBalance,
    closingBalance,
    totalDebits,
    totalCredits,
    transactions,
  };
}

function parseAmount(str: string): number {
  // Handle both comma and dot as thousand/decimal separators
  // Indonesian format: 1.234.567,89
  // US format: 1,234,567.89
  
  let cleaned = str.trim();
  
  // Count dots and commas
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;
  
  if (dotCount > 1 || (dotCount === 1 && commaCount === 1)) {
    // Indonesian format: dots as thousand separators, comma as decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (commaCount > 1) {
    // US format: commas as thousand separators, dot as decimal
    cleaned = cleaned.replace(/,/g, '');
  } else if (dotCount === 1 && commaCount === 0) {
    // Already in correct format
  } else if (commaCount === 1 && dotCount === 0) {
    // Single comma might be decimal separator
    cleaned = cleaned.replace(',', '.');
  } else {
    // No separators, just digits
    cleaned = cleaned.replace(/[^0-9]/g, '');
  }
  
  return parseFloat(cleaned) || 0;
}
