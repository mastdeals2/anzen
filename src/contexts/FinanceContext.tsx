import React, { createContext, useContext, useState } from 'react';

interface DateRange {
  from: Date;
  to: Date;
}

interface FinanceContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  return (
    <FinanceContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
