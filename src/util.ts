export const getDayFormat = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
};

export const addMinutes = (date = new Date(), mins = 0): Date => {
  return new Date(date.getTime() + mins * 60 * 1000); // m * s * ms
};

export const addHours = (date = new Date(), hour = 0): Date => {
  return addMinutes(date, 60 * hour);
};

export const addDays = (date = new Date(), days = 0): Date => {
  return addHours(date, 24 * days);
};

export const getHHMM = (date = new Date()): string => {
  return `${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}`;
};
