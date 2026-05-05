import { usePageData } from '@croco/frontend-react';

type HomePageData = {
  readonly message: string;
};

export default function Page() {
  const { message } = usePageData<HomePageData>();

  return (
    <main>
      <h1>Croco Console</h1>
      <p>{message}</p>
    </main>
  );
}
