console.error(
  "Publishing is only supported by the protected Release workflow on trunk. See RELEASING.md.",
);
process.exitCode = 1;
