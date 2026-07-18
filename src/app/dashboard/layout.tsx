export const metadata = {
  title: 'Ad Reports - TaskifiAI Dashboard',
  description: 'AI-powered ad performance analysis',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
