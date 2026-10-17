"use client";

import React, { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" data-testid="counter" onClick={() => setCount((value) => value + 1)}>
      Browser:interactive count={count}
    </button>
  );
}
