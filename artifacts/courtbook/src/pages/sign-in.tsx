import { SignIn } from "@clerk/react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="relative flex items-center justify-center min-h-screen py-8">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 rounded-full"
        onClick={() => setLocation("/")}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </Button>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}
