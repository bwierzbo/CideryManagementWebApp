import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: string;
      isActive?: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    role?: string;
    isActive?: boolean;
  }
}
