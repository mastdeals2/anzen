# Petty Cash Management & Asset Recording Guide

## Overview

The **Petty Cash Management** module now has full categorization and linking capabilities, just like the Expenses module. This allows you to properly track all cash transactions with complete accounting integration.

---

## Features

### 1. **Full Expense Categorization**

Petty cash expenses now support the same comprehensive category system as bank-paid expenses:

#### Import Costs (Capitalized to Inventory)
- Duty & Customs (BM)
- PPh Import
- Freight (Import)
- Clearing & Forwarding
- Port Charges
- Container Handling
- Transportation (Import)
- Loading/Unloading (Import)
- BPOM / SKI Fees
- Other (Import)

#### Sales & Distribution (Expensed)
- Delivery / Dispatch (Sales)
- Loading / Unloading (Sales)
- Other (Sales)

#### Staff Costs (Expensed)
- Salary
- Staff Overtime
- Staff Welfare / Allowances
- Travel & Conveyance

#### Operations (Expensed)
- Warehouse Rent
- Utilities
- Bank Charges
- PPN Import

#### Administrative (Expensed)
- Office & Admin
- Office Shifting & Renovation
- Other

#### Assets (Capitalized)
- Fixed Assets / Equipment

---

### 2. **Linking to Business Transactions**

#### Link to Import Containers
For import-related expenses (those marked as "CAPITALIZED"), you can link them to specific import containers. This ensures:
- Costs are properly allocated to inventory
- Landed cost calculation is accurate
- Import costs are tracked per container

**Categories requiring container link:**
- All "Import Costs" categories except PPN Import

#### Link to Delivery Challans (Sales)
For sales-related cash expenses, you can link them to specific delivery challans:
- Delivery charges for specific customer orders
- Loading costs for particular shipments
- Direct attribution of sales expenses

**Use cases:**
- Customer delivery paid in cash
- Loading charges at customer location
- Any cash expense directly related to a sale

---

### 3. **Document Management**

Upload receipts and supporting documents:
- **File upload**: Click to browse files
- **Paste support**: Copy image → Paste directly in form
- **Multiple files**: Attach multiple receipts per transaction
- **Supported formats**: Images (JPG, PNG) and PDF

---

## Recording Fixed Assets

### What are Fixed Assets?

Fixed assets are items purchased for long-term use (more than 1 year) in the business:
- Computers & laptops
- Machinery & equipment
- Furniture & fixtures
- Vehicles
- Air conditioning units
- Shelving & racking
- Office equipment

### How to Record Asset Purchases

#### Step 1: Create Petty Cash Transaction
1. Go to **Finance → Petty Cash**
2. Click **Add Transaction**
3. Select **Expense (Cash Out)**

#### Step 2: Select Asset Category
1. In "Expense Category", scroll to **Assets** section
2. Select **"Fixed Assets / Equipment"**
3. This category is marked as "CAPITALIZED"

#### Step 3: Fill Details
- **Date**: Purchase date
- **Amount**: Full purchase price
- **Description**: Detailed description (e.g., "Dell Latitude 5520 Laptop - Serial: ABC123")
- **Paid To**: Vendor/supplier name
- **Paid By**: Staff member who made purchase
- **Upload Documents**: Purchase invoice, receipt, warranty card

#### Step 4: Save Transaction
- Transaction is recorded
- Accounting entry created:
  - **Debit**: Fixed Assets account
  - **Credit**: Cash account
- Asset value is CAPITALIZED (not expensed)

### What Happens After Recording?

1. **Asset appears** in your Chart of Accounts under "Fixed Assets"
2. **Finance team** will later set up depreciation schedule
3. **Depreciation** will be expensed over the asset's useful life
4. **Example**:
   - Computer cost: Rp 10,000,000
   - Useful life: 5 years
   - Annual depreciation: Rp 2,000,000 per year

---

## Petty Cash Workflow

### 1. **Cash Withdrawal from Bank**

When you withdraw cash from bank for petty cash:

1. Select **"Withdraw from Bank"**
2. Choose bank account
3. Enter amount and withdrawal reference
4. Record who received the cash

**Accounting**:
- Debit: Petty Cash (increases cash on hand)
- Credit: Bank Account (reduces bank balance)

### 2. **Cash Expenses**

When you spend cash:

1. Select **"Expense (Cash Out)"**
2. Choose appropriate category
3. Link to container or DC if applicable
4. Upload receipt
5. Record vendor and staff details

**Accounting** (varies by category):
- **If Import Cost**: Debit Inventory, Credit Cash
- **If Operating Expense**: Debit Expense, Credit Cash
- **If Fixed Asset**: Debit Fixed Assets, Credit Cash

---

## Filtering & Reporting

### Filter by Type
- **Import Costs**: All container-related expenses
- **Sales & Distribution**: Customer delivery, dispatch
- **Staff Costs**: Salaries, welfare, travel
- **Operations**: Rent, utilities, bank charges
- **Administrative**: Office supplies, admin
- **Assets**: Equipment purchases

### Filter by Category
Drill down to specific expense category for detailed analysis

### Date Range
Use the master date range filter (from Finance context) to view transactions for specific periods

---

## Best Practices

### 1. **Always Upload Receipts**
- Paste photos directly from phone/scanner
- Maintain audit trail
- Support for expense verification

### 2. **Link to Source Documents**
- Import expenses → Link to container
- Sales expenses → Link to delivery challan
- Proper cost allocation

### 3. **Detailed Descriptions**
- Who was paid
- What was purchased
- Why it was needed
- Reference numbers if any

### 4. **Regular Reconciliation**
- Check cash balance regularly
- Verify against physical cash count
- Investigate discrepancies immediately

### 5. **Asset Documentation**
For fixed assets, include:
- Serial numbers
- Model numbers
- Warranty information
- Purchase invoice
- Location/assigned to

---

## Common Scenarios

### Scenario 1: Paying Import Duty in Cash

1. Transaction Type: **Expense**
2. Category: **Duty & Customs (BM)**
3. Link to: **Select import container**
4. Description: "BM duty payment for container CONT-2024-001"
5. Upload: Duty payment receipt

**Result**: Cost capitalized to inventory of that container

---

### Scenario 2: Customer Delivery Paid in Cash

1. Transaction Type: **Expense**
2. Category: **Delivery / Dispatch (Sales)**
3. Link to: **Select delivery challan**
4. Description: "Delivery to PT ABC, Jakarta"
5. Paid To: "Driver - Budi"

**Result**: Delivery expense recorded against that sale

---

### Scenario 3: Purchasing Office Computer

1. Transaction Type: **Expense**
2. Category: **Fixed Assets / Equipment**
3. Description: "Dell Latitude 5520, Intel i5, 8GB RAM, SN: XYZ789"
4. Amount: Rp 8,500,000
5. Paid To: "Computer Store Jakarta"
6. Upload: Purchase invoice and warranty

**Result**: Asset capitalized, will be depreciated over time

---

### Scenario 4: Staff Meal Allowance

1. Transaction Type: **Expense**
2. Category: **Staff Welfare / Allowances**
3. Description: "Driver meal allowance - overtime delivery"
4. Paid To: "Driver - Ahmad"

**Result**: Staff cost expensed to P&L

---

### Scenario 5: Port Handling Charges

1. Transaction Type: **Expense**
2. Category: **Port Charges**
3. Link to: **Select container**
4. Description: "Port handling fee at Tanjung Priok"
5. Paid To: "Port Authority"

**Result**: Cost capitalized to inventory of that container

---

## Accounting Integration

All petty cash transactions automatically create journal entries:

### Cash Withdrawal
```
Dr. Petty Cash                 Rp XXX
  Cr. Bank Account                     Rp XXX
```

### Import Cost (Capitalized)
```
Dr. Inventory / Work in Progress    Rp XXX
  Cr. Petty Cash                            Rp XXX
```

### Operating Expense
```
Dr. [Expense Category]         Rp XXX
  Cr. Petty Cash                        Rp XXX
```

### Fixed Asset Purchase
```
Dr. Fixed Assets               Rp XXX
  Cr. Petty Cash                        Rp XXX
```

---

## Reports & Analysis

### View in Accounting Reports
1. **Cash Flow**: See all cash movements
2. **Expense Analysis**: View expenses by category
3. **Import Costing**: Container-linked expenses included in landed cost
4. **Balance Sheet**: Fixed assets appear correctly

### Petty Cash Balance
- Real-time balance shown on dashboard
- Should match physical cash count
- Investigate any discrepancies

---

## Tips for Asset Management

### Creating an Asset Register

After recording asset purchases in petty cash:

1. **Maintain separate asset register** (can be Excel/Google Sheets)
2. **Track details**:
   - Asset tag number
   - Purchase date
   - Cost
   - Location
   - Assigned to (person/department)
   - Condition
   - Depreciation rate
   - Accumulated depreciation
   - Net book value

3. **Physical verification**: Conduct annual asset verification

4. **Disposal tracking**: When assets are sold/scrapped, record properly

---

## Questions & Support

### Q: Should I record all cash expenses here?
**A:** Yes, all cash payments should be recorded in Petty Cash for proper accounting.

### Q: What if I paid by personal cash and need reimbursement?
**A:** Record as petty cash expense, note in description "Reimbursement due to [Name]", and process reimbursement separately.

### Q: Can I edit transactions later?
**A:** Yes, authorized users can edit transactions if corrections are needed.

### Q: What about depreciation of assets?
**A:** Depreciation is handled separately by finance team in accounting system. Just record the purchase here.

### Q: How do I reconcile petty cash?
**A:**
1. Check "Current Cash Balance" on dashboard
2. Count physical cash
3. Compare
4. Investigate any differences

---

## Summary

The enhanced Petty Cash module gives you:

- ✅ **Full categorization** like bank expenses
- ✅ **Linking to containers** for import costs
- ✅ **Linking to delivery challans** for sales expenses
- ✅ **Document upload** with paste support
- ✅ **Asset recording** with proper capitalization
- ✅ **Automatic accounting** integration
- ✅ **Advanced filtering** and reporting
- ✅ **Real-time balance** tracking

Use this system to maintain complete and accurate petty cash records with full audit trail!
