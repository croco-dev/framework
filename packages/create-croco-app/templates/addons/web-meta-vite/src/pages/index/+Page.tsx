import React from "react";
import { useRequiredPageData } from "@croco/frontend-react";

export default function Page() {
  const { message } = useRequiredPageData<{ message: string }>();

  return (
    <div>
      <h1>Welcome to {{ projectName }}</h1>
      <p>{message}</p>
    </div>
  );
}
