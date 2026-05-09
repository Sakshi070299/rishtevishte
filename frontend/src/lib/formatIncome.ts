export const formatIncome = (income: string | number): string => {
    const num = typeof income === "string" ? Number(income) : income;
  
    if (isNaN(num)) return "";
  
    if (num >= 10000000) {
      return (num / 10000000).toFixed(1).replace(/\.0$/, "") + "Cr"; // Crore
    }
  
    if (num >= 100000) {
      return (num / 100000).toFixed(1).replace(/\.0$/, "") + "L"; // Lakh
    }
  
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k"; // Thousand
    }
  
    return num.toString();
  };