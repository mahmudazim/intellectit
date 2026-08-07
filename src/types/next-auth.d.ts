import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    fullName: string;
    mustChangePw: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      fullName: string;
      mustChangePw: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    fullName: string;
    mustChangePw: boolean;
  }
}
