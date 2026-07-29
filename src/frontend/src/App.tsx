import { router } from "@/router";
import { ExtensionCaptureBridge } from "@/components/ExtensionCaptureBridge";
import { RouterProvider } from "@tanstack/react-router";

export default function App() {
  return (
    <>
      <ExtensionCaptureBridge />
      <RouterProvider router={router} />
    </>
  );
}
