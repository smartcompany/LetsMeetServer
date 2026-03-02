import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '신고 관리 대시보드',
  description: '모임·피드 신고 관리',
};

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return <>{children}</>;
}
