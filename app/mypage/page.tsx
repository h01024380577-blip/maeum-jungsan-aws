import { redirect } from 'next/navigation';

// /mypage는 /stats(=MY 탭)으로 통합됨. 기존 딥링크 호환용 리다이렉트.
export default function MyPageRedirect() {
  redirect('/stats');
}
