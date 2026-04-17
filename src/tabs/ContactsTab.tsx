import React, { useState } from 'react';
import { Search, UserPlus, ArrowRight, User, CheckCircle, AlertCircle, Star } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import ContactDetail from '../components/ContactDetail';

export default function ContactsTab() {
  const { contacts, entries, syncContacts, updateContact } = useStore();
  const [search, setSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'recent'>('name');

  const getBalance = (id: string) => {
    const ce = entries.filter(e => e.contactId === id);
    return ce.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0) - ce.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
  };

  const getRecent = (id: string) => {
    const ce = entries.filter(e => e.contactId === id);
    return ce.length === 0 ? 0 : Math.max(...ce.map(e => new Date(e.date).getTime()));
  };

  const getCount = (id: string) => entries.filter(e => e.contactId === id).length;

  const filtered = contacts
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // 즐겨찾기 항상 우선
      const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
      if (favDiff !== 0) return favDiff;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'balance') return getBalance(b.id) - getBalance(a.id);
      return getRecent(b.id) - getRecent(a.id);
    });

  const toggleFavorite = (id: string, current: boolean) => {
    updateContact(id, { isFavorite: !current });
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string; count?: number } | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { fetchContacts, FetchContactsPermissionError } = await import('@apps-in-toss/web-framework');

      // 권한 확인
      const permission = await fetchContacts.getPermission() as string;
      if (permission === 'denied' || permission === 'osPermissionDenied') {
        const result = await fetchContacts.openPermissionDialog();
        if (result === 'denied') {
          alert('연락처 접근 권한이 필요합니다. 설정에서 허용해 주세요.');
          return;
        }
      } else if (permission === 'notDetermined') {
        const result = await fetchContacts.openPermissionDialog();
        if (result === 'denied') {
          alert('연락처 접근 권한이 필요합니다.');
          return;
        }
      }

      // 연락처 전체 가져오기 (페이지네이션)
      const allContacts: { name: string; phone: string; relation: string }[] = [];
      let offset = 0;
      const size = 50;

      while (true) {
        const res = await fetchContacts({ size, offset });
        const items = res.result ?? [];
        for (const item of items) {
          if (item.name) {
            allContacts.push({
              name: item.name,
              phone: (item as any).phoneNumbers?.[0] ?? '',
              relation: '지인',
            });
          }
        }
        if (res.done || res.nextOffset == null) break;
        offset = res.nextOffset;
      }

      if (allContacts.length === 0) {
        setSyncResult({ type: 'error', message: '가져올 연락처가 없습니다' });
        return;
      }

      await syncContacts(allContacts);
      setSyncResult({ type: 'success', message: '연락처를 불러왔습니다', count: allContacts.length });
    } catch (err: any) {
      console.error('연락처 불러오기 실패:', err);
      if (err?.name === 'FetchContactsPermissionError') {
        setSyncResult({ type: 'error', message: '연락처 접근 권한이 필요합니다\n설정에서 허용해 주세요' });
      } else {
        setSyncResult({ type: 'error', message: '연락처를 불러오지 못했습니다' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (selectedContactId) {
    return (
      <div className="px-5 pt-14 pb-4">
        <ContactDetail contactId={selectedContactId} onBack={() => setSelectedContactId(null)} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="px-5 pt-14 pb-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-black text-gray-900 tracking-tight">연락처 관리</h1>
            <p className="text-xs text-gray-400 mt-0.5">{contacts.length}명의 연락처</p>
          </div>
          <button onClick={() => setShowConfirm(true)} disabled={isSyncing} className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-colors active:scale-95 disabled:opacity-50">
            {isSyncing ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <UserPlus size={18} />}
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input type="text" placeholder="이름으로 검색..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-blue-100 outline-none text-sm placeholder:text-gray-300" />
        </div>

        <div className="flex space-x-2">
          {([['name', '이름순'], ['balance', '수지순'], ['recent', '최근순']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${sortBy === key ? 'bg-blue-500 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((c) => {
            const bal = getBalance(c.id);
            const cnt = getCount(c.id);
            return (
              <motion.div layout key={c.id} onClick={() => setSelectedContactId(c.id)}
                className={`bg-white p-4 rounded-2xl border flex items-center justify-between hover:shadow-md transition-all cursor-pointer group active:scale-[0.98] ${c.isFavorite ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(c.id, !!c.isFavorite); }}
                    className="shrink-0 p-1 -m-1 rounded-lg active:scale-90 transition-all"
                    aria-label={c.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    <Star
                      size={18}
                      className={c.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-200 hover:text-amber-300'}
                    />
                  </button>
                  <div className="w-11 h-11 shrink-0 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    <User size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{c.name}</h3>
                    <p className="text-[10px] text-gray-400 font-medium">{c.relation} · {cnt}건</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className={`text-sm font-black flex items-center justify-end ${bal === 0 ? 'text-gray-400' : bal > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {bal >= 0 ? '+' : ''}{bal.toLocaleString()}
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-200 group-hover:text-blue-500 transition-colors" />
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mx-auto text-gray-300 mb-3"><User size={28} /></div>
              <p className="text-sm text-gray-300 font-medium">연락처가 없습니다</p>
            </div>
          )}
        </div>
      </div>

      {/* 연락처 연동 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" onClick={() => setShowConfirm(false)}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-xl"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <UserPlus size={22} className="text-blue-500" />
            </div>
            <h3 className="text-base font-black text-gray-900 text-center">전화번호부 연동</h3>
            <p className="text-xs text-gray-400 text-center mt-2 leading-relaxed">
              기기의 전화번호부에서 연락처를<br/>불러옵니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 bg-gray-100 active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleSync(); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-500 active:scale-95 transition-all"
              >
                연동하기
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 연동 결과 모달 */}
      <AnimatePresence>
        {syncResult && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6" onClick={() => setSyncResult(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-xl text-center"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${syncResult.type === 'success' ? 'bg-blue-50' : 'bg-red-50'}`}>
                {syncResult.type === 'success'
                  ? <CheckCircle size={28} className="text-blue-500" />
                  : <AlertCircle size={28} className="text-red-400" />
                }
              </div>
              {syncResult.type === 'success' && syncResult.count && (
                <p className="text-3xl font-black text-gray-900 mb-1">{syncResult.count}<span className="text-base font-bold text-gray-400">명</span></p>
              )}
              <p className="text-sm font-bold text-gray-700 whitespace-pre-line">{syncResult.message}</p>
              <button
                onClick={() => setSyncResult(null)}
                className={`w-full mt-5 py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all ${syncResult.type === 'success' ? 'bg-blue-500' : 'bg-red-400'}`}
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
