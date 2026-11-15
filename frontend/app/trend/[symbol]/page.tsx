"use client";
import { use } from "react";
import TrendAnalysisModal from "@/components/TrendAnalysisModal";
import { useRouter } from "next/navigation";

export default function TrendPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center p-4">
      <TrendAnalysisModal
        symbol={decodeURIComponent(symbol)}
        onClose={() => router.back()}
      />
    </div>
  );
}
