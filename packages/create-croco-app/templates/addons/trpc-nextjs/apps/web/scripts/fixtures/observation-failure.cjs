const originalInfo = console.info;

console.info = (...args) => {
  const value = args[0];
  if (typeof value === "string" && value.startsWith('{"eventName":"product.trial.committed",')) {
    originalInfo.apply(console, args);
    throw new Error("Synthetic smoke observation failure");
  }
  originalInfo.apply(console, args);
};
