import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '운영 대시보드',
  description: '신고 관리 및 AI 모임 봇 컨트롤',
};

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return <>{children}</>;
}
