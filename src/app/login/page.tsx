import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="flex min-h-full flex-1 items-center justify-center">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
