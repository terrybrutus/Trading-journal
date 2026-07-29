import { router } from "@/router";
import { RouterProvider } from "@tanstack/react-router";

export default function App() {
  return <RouterProvider router={router} />;
}
