import { useRequiredPageData } from "@croco/frontend-react";

type HomePageData = {
  readonly message: string;
};

export default function Page() {
  const { message } = useRequiredPageData<HomePageData>();

  return (
    <main>
      <h1>Croco Console</h1>
      <p>{message}</p>
    </main>
  );
}
