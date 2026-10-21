"use client";
import { createContext, useContext } from "react";

// Lets an admin page send the host back to the login form when a request returns 401.
export const AdminContext = createContext<{ expired: () => void }>({ expired: () => {} });

export const useAdmin = () => useContext(AdminContext);
