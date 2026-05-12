import { usePageData } from '@croco/frontend-react';

export default function Page() {
  const { message } = usePageData<{ message: string }>();

  return (
    <div>
      <h1>Welcome to {{ projectName }}</h1>
      <p>{message}</p>
    </div>
  );
}
