import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import DefaultLayout from "@/layouts/DefaultLayout";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/api/api-auth";

export default function HomePage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    void logout().finally(() => navigate("/login"));
  };

  return (
    <DefaultLayout>
      <div className="absolute top-4 right-4 z-10">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/10 ring-1 ring-primary/20 mb-6">
            <Logo className="w-14 h-14 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
            Welcome to Your Junior
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Your personal AI-powered junior assistant. Ready to help with your tasks.
          </p>
        </div>
      </div>
    </DefaultLayout>
  );
}
