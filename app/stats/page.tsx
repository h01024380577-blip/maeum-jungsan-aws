"use client";

import MyPageTab from "@/src/tabs/MyPageTab";
import Layout from "@/components/Layout";

// 라우트 경로는 /stats 유지 (딥링크·탭 상태 호환), 내용은 MY 탭.
export default function MyTabPage() {
  return (
    <Layout activeTab="stats">
      <MyPageTab />
    </Layout>
  );
}
