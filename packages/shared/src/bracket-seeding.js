const seedSlotOrders = {
  4: [1, 4, 2, 3],
  6: [3, 6, 4, 5, 1, 2],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
  16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11],
};

export function getSeedSlotOrder(size) {
  return [...(seedSlotOrders[size] ?? seedSlotOrders[16])];
}
