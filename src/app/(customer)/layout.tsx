import { DemoRibbon } from "@/components/demo-ribbon";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DemoRibbon />
      {children}
    </>
  );
}
