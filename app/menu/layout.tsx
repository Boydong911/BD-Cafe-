import { CartSheet } from "@/components/customer/cart-sheet";

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CartSheet />
    </>
  );
}