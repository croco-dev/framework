async function main(): Promise<void> {
  const response = await fetch("http://127.0.0.1:4181/api/tick", { method: "POST" });
  if (!response.ok)
    throw new Error(`Reminder tick failed: ${response.status} ${await response.text()}`);
  console.log(await response.json());
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
