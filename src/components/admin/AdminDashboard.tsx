import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, Edit3, Save, Download, Copy, Check, AlertCircle, 
  Search, ArrowLeft, RefreshCw, Key, ShieldCheck, Sparkles, 
  ExternalLink, Eye, Utensils
} from 'lucide-react';
import { foods as initialFoods, type Food, serializeFoodsToTs } from '@/lib/foods';
import { priceRarity } from '@/lib/case-mechanics';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const rarityNames = ['Mil-Spec (Phổ biến)', 'Restricted (Ít gặp)', 'Classified (Hiếm)', 'Covert (Rất hiếm)', '★ Special / Gold (Cực phẩm)'];
const rarityColors = ['#4b69ff', '#8847ff', '#d32ce6', '#eb4b4b', '#e4ae39'];

function MiniFoodImage({ imageId, alt, size = 48 }: { imageId: number; alt: string; size?: number }) {
  if (imageId < 0 || imageId > 131) {
    return (
      <div className="flex items-center justify-center bg-zinc-800 rounded border border-zinc-700 text-zinc-400" style={{ width: size, height: size }}>
        <Utensils size={size * 0.5} />
      </div>
    );
  }
  const common = imageId >= 120;
  const lunch = imageId >= 72 && !common;
  const expanded = imageId >= 36;
  const index = common ? (imageId - 120) % 12 : lunch ? (imageId - 72) % 12 : expanded ? (imageId - 36) % 12 : imageId % 4;
  const atlas = common ? `food-common-${Math.floor((imageId - 120) / 12)}` : lunch ? `food-lunch-${Math.floor((imageId - 72) / 12)}` : expanded ? `food-expanded-${Math.floor((imageId - 36) / 12)}` : `food-hd-${Math.floor(imageId / 4)}`;

  return (
    <div
      role="img"
      aria-label={alt}
      className="rounded overflow-hidden shrink-0 border border-zinc-700 bg-zinc-900"
      style={{
        width: size,
        height: size,
        clipPath: common ? 'inset(0 0 4% 0)' : lunch ? 'inset(0 0 7% 0)' : undefined,
        backgroundImage: `url(${basePath}/${atlas}.webp)`,
        backgroundSize: expanded ? '400% 300%' : '200% 200%',
        backgroundPosition: expanded ? `${(index % 4) / 3 * 100}% ${(common ? [0, 50, 100] : [0, 46, 92])[Math.floor(index / 4)]}%` : `${(index % 2) * 100}% ${Math.floor(index / 2) * 100}%`
      }}
    />
  );
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [dishes, setDishes] = useState<Food[]>(() => initialFoods);
  const [search, setSearch] = useState('');
  const [filterVeg, setFilterVeg] = useState<'all' | 'veg' | 'meat'>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');

  // GitHub Settings
  const [ghOwner, setGhOwner] = useState(() => localStorage.getItem('admin_gh_owner') || 'khanghohy');
  const [ghRepo, setGhRepo] = useState(() => localStorage.getItem('admin_gh_repo') || 'truanayangi');
  const [ghToken, setGhToken] = useState(() => localStorage.getItem('admin_gh_token') || '');
  const [ghBranch, setGhBranch] = useState('main');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Edit / Add Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formSub, setFormSub] = useState('');
  const [formPrice, setFormPrice] = useState<number>(45);
  const [formImage, setFormImage] = useState<number>(0);
  const [formVeg, setFormVeg] = useState(false);
  const [formQuip, setFormQuip] = useState('');
  const [formError, setFormError] = useState('');

  // Image Picker Modal
  const [pickerOpen, setPickerOpen] = useState(false);

  // Commit / Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ commitUrl?: string; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Save GH config locally
  useEffect(() => {
    localStorage.setItem('admin_gh_owner', ghOwner);
    localStorage.setItem('admin_gh_repo', ghRepo);
    if (ghToken) localStorage.setItem('admin_gh_token', ghToken);
  }, [ghOwner, ghRepo, ghToken]);

  // Test connection to GitHub
  const testConnection = async () => {
    if (!ghToken.trim()) {
      setConnectionStatus({ ok: false, msg: 'Vui lòng nhập GitHub Token trước.' });
      return;
    }
    setVerifyingToken(true);
    setConnectionStatus(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/src/lib/foods.ts?ref=${ghBranch}`, {
        headers: {
          Authorization: `Bearer ${ghToken.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus({ ok: true, msg: `Kết nối thành công tới ${ghOwner}/${ghRepo}! (SHA: ${data.sha?.slice(0, 7)})` });
      } else if (res.status === 404) {
        setConnectionStatus({ ok: false, msg: `Không tìm thấy file hoặc repo ${ghOwner}/${ghRepo}. Kiểm tra lại tên owner/repo.` });
      } else if (res.status === 401) {
        setConnectionStatus({ ok: false, msg: 'Token không hợp lệ hoặc đã hết hạn.' });
      } else {
        setConnectionStatus({ ok: false, msg: `Lỗi kết nối GitHub (HTTP ${res.status}).` });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setConnectionStatus({ ok: false, msg: `Lỗi mạng: ${err.message}` });
    } finally {
      setVerifyingToken(false);
    }
  };

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter(f => {
      const matchSearch = f.name.toLowerCase().includes(search.toLowerCase()) || f.sub.toLowerCase().includes(search.toLowerCase());
      const matchVeg = filterVeg === 'all' ? true : filterVeg === 'veg' ? f.veg : !f.veg;
      const matchRarity = filterRarity === 'all' ? true : String(f.rarity) === filterRarity;
      return matchSearch && matchVeg && matchRarity;
    });
  }, [dishes, search, filterVeg, filterRarity]);

  // Open modal to add or edit
  const openAddModal = () => {
    setEditingIndex(null);
    setFormName('');
    setFormSub('Việt Nam');
    setFormPrice(45);
    setFormImage(Math.floor(Math.random() * 130));
    setFormVeg(false);
    setFormQuip('Ngon lành cành đào.');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (dish: Food, actualIndex: number) => {
    setEditingIndex(actualIndex);
    setFormName(dish.name);
    setFormSub(dish.sub);
    setFormPrice(dish.price);
    setFormImage(dish.image);
    setFormVeg(!!dish.veg);
    setFormQuip(dish.quip || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveDish = () => {
    if (!formName.trim()) {
      setFormError('Tên món không được để trống.');
      return;
    }
    if (formPrice <= 0 || isNaN(formPrice)) {
      setFormError('Giá tiền không hợp lệ.');
      return;
    }

    const calculatedRarity = priceRarity(formPrice);
    const newDish: Food = {
      name: formName.trim(),
      sub: formSub.trim() || 'Món ăn',
      price: formPrice,
      image: formImage,
      rarity: calculatedRarity,
      veg: formVeg ? true : undefined,
      quip: formQuip.trim() || 'Thử ngay!'
    };

    if (editingIndex !== null) {
      const updated = [...dishes];
      updated[editingIndex] = newDish;
      setDishes(updated);
    } else {
      setDishes([newDish, ...dishes]);
    }
    setModalOpen(false);
  };

  const handleDeleteDish = (index: number) => {
    if (confirm(`Bạn có chắc chắn muốn xóa món "${dishes[index].name}"?`)) {
      const updated = dishes.filter((_, i) => i !== index);
      setDishes(updated);
    }
  };

  // Commit directly to GitHub via API
  const handlePublishToGitHub = async () => {
    if (!ghToken.trim()) {
      setSaveError('Vui lòng nhập GitHub Token ở mục cấu hình phía trên trước khi xuất bản.');
      return;
    }
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      // 1. Get current file SHA
      const getRes = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/src/lib/foods.ts?ref=${ghBranch}`, {
        headers: {
          Authorization: `Bearer ${ghToken.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!getRes.ok) {
        throw new Error(`Không lấy được thông tin file từ GitHub (Mã lỗi: ${getRes.status}). Kiểm tra lại quyền Token.`);
      }

      const fileData = await getRes.json();
      const currentSha = fileData.sha;

      // 2. Generate updated TypeScript code
      const tsCode = serializeFoodsToTs(dishes);
      
      // UTF-8 to Base64
      const utf8Bytes = new TextEncoder().encode(tsCode);
      let binaryStr = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryStr += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryStr);

      // 3. PUT file update to GitHub
      const putRes = await fetch(`https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/src/lib/foods.ts`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ghToken.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Admin: Cập nhật danh sách món ăn (${dishes.length} món)`,
          content: base64Content,
          sha: currentSha,
          branch: ghBranch
        })
      });

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Lưu thất bại (Mã lỗi: ${putRes.status})`);
      }

      const result = await putRes.json();
      const commitHtmlUrl = result.commit?.html_url || `https://github.com/khanghohy/truanayangi/commits/${ghBranch}`;
      
      setSaveSuccess({
        commitUrl: commitHtmlUrl,
        message: `Đã lưu thành công lên GitHub! GitHub Actions đang tự động build và deploy. Website sẽ cập nhật danh sách món mới sau khoảng 1 phút.`
      });
    } catch (e: unknown) {
      const err = e as Error;
      setSaveError(err.message || 'Đã có lỗi xảy ra khi lưu lên GitHub.');
    } finally {
      setIsSaving(false);
    }
  };

  // Download foods.ts backup
  const handleDownloadTs = () => {
    const tsCode = serializeFoodsToTs(dishes);
    const blob = new Blob([tsCode], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foods.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy code to clipboard
  const handleCopyCode = () => {
    const tsCode = serializeFoodsToTs(dishes);
    navigator.clipboard.writeText(tsCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 md:p-8 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg border border-zinc-700 text-sm font-medium transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            Quay lại Roulette
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Quản Trị Món Ăn
            </h1>
            <span className="bg-amber-950 text-amber-300 text-xs px-2 py-0.5 rounded border border-amber-700 font-mono">
              Admin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition shadow-lg shadow-emerald-950 cursor-pointer"
          >
            <Plus size={16} />
            Thêm Món Mới
          </button>
          <button
            onClick={handlePublishToGitHub}
            disabled={isSaving}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 font-bold px-4 py-2 rounded-lg text-sm transition shadow-lg shadow-amber-950 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Đang xuất bản...' : 'Lưu & Xuất Bản GitHub'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alerts */}
        {saveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-600/60 p-4 rounded-xl flex items-start gap-3 text-emerald-200">
            <Check size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300">{saveSuccess.message}</p>
              {saveSuccess.commitUrl && (
                <a
                  href={saveSuccess.commitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-400 underline hover:text-emerald-300"
                >
                  Xem commit trên GitHub <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {saveError && (
          <div className="bg-rose-950/80 border border-rose-600/60 p-4 rounded-xl flex items-start gap-3 text-rose-200">
            <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300">Lưu thất bại!</p>
              <p className="text-sm">{saveError}</p>
            </div>
          </div>
        )}

        {/* GitHub Config Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-amber-400" size={20} />
              <h2 className="text-base font-semibold text-zinc-200">Cấu Hình Kết Nối GitHub Để Tự Động Deploy</h2>
            </div>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=TruaNayAnGi+Admin"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1"
            >
              Tạo GitHub Token 30s tại đây <ExternalLink size={12} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">GitHub Owner</label>
              <input
                value={ghOwner}
                onChange={e => setGhOwner(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Repository Name</label>
              <input
                value={ghRepo}
                onChange={e => setGhRepo(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nhánh (Branch)</label>
              <input
                value={ghBranch}
                onChange={e => setGhBranch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                GitHub Token <span className="text-zinc-500">(chỉ lưu trên máy bạn)</span>
              </label>
              <div className="relative">
                <input
                  type={tokenVisible ? 'text' : 'password'}
                  value={ghToken}
                  placeholder="ghp_xxxxxxxxxxxx"
                  onChange={e => setGhToken(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-zinc-200 text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setTokenVisible(!tokenVisible)}
                  className="absolute right-2 top-2.5 text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  <Eye size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={testConnection}
                disabled={verifyingToken}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded border border-zinc-600 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {verifyingToken ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                Kiểm tra kết nối
              </button>
              {connectionStatus && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${connectionStatus.ok ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'}`}>
                  {connectionStatus.msg}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadTs}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded border border-zinc-700 transition flex items-center gap-1 cursor-pointer"
                title="Tải file foods.ts về máy để commit thủ công"
              >
                <Download size={14} /> Tải file foods.ts
              </button>
              <button
                onClick={handleCopyCode}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded border border-zinc-700 transition flex items-center gap-1 cursor-pointer"
              >
                {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedCode ? 'Đã copy' : 'Sao chép mã'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs sm:text-sm text-zinc-400 flex-wrap">
            <span>Tổng cộng: <strong className="text-zinc-100">{dishes.length} món</strong></span>
            <span>·</span>
            <span>Món chay: <strong className="text-emerald-400">{dishes.filter(f => f.veg).length} món</strong></span>
            <span>·</span>
            <span>Giá TB: <strong className="text-amber-400">{Math.round(dishes.reduce((a, b) => a + b.price, 0) / dishes.length)}k VND</strong></span>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                placeholder="Tìm món theo tên, xuất xứ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={filterVeg}
              onChange={e => setFilterVeg(e.target.value as 'all' | 'veg' | 'meat')}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tất cả loại</option>
              <option value="meat">Món mặn</option>
              <option value="veg">Món chay 🌱</option>
            </select>

            <select
              value={filterRarity}
              onChange={e => setFilterRarity(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tất cả bậc giá</option>
              <option value="0">Xanh (&lt;40k)</option>
              <option value="1">Tím (40-60k)</option>
              <option value="2">Hồng (60-90k)</option>
              <option value="3">Đỏ (90-140k)</option>
              <option value="4">Vàng Dao (≥140k)</option>
            </select>
          </div>
        </div>

        {/* Dishes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDishes.map((dish) => {
            const actualIndex = dishes.findIndex(d => d === dish);
            const rarityColor = rarityColors[dish.rarity] || '#4b69ff';

            return (
              <div
                key={actualIndex}
                className="bg-zinc-900 border rounded-xl overflow-hidden shadow-md hover:border-zinc-500 transition relative flex flex-col justify-between"
                style={{ borderColor: `${rarityColor}66` }}
              >
                {/* Top tier badge */}
                <div
                  className="px-3 py-1 text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-zinc-950"
                  style={{ backgroundColor: rarityColor }}
                >
                  <span>{rarityNames[dish.rarity].split(' ')[0]}</span>
                  <span>{dish.price}k VNĐ</span>
                </div>

                <div className="p-3 flex items-start gap-3">
                  <MiniFoodImage imageId={dish.image} alt={dish.name} size={54} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-zinc-100 truncate flex items-center gap-1">
                      {dish.name}
                      {dish.veg && <span title="Món chay">🌱</span>}
                    </h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{dish.sub}</p>
                    <p className="text-xs text-zinc-500 italic truncate mt-1">"{dish.quip}"</p>
                  </div>
                </div>

                {/* Bottom action buttons */}
                <div className="border-t border-zinc-800 bg-zinc-950/60 px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono">ID ảnh: #{dish.image}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(dish, actualIndex)}
                      className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
                      title="Chỉnh sửa món"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteDish(actualIndex)}
                      className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-zinc-800 transition cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredDishes.length === 0 && (
          <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
            <p className="text-zinc-400">Không tìm thấy món ăn nào phù hợp với bộ lọc.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dish Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                {editingIndex !== null ? 'Chỉnh Sửa Món Ăn' : 'Thêm Món Ăn Mới'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <p className="text-rose-400 text-xs bg-rose-950/60 border border-rose-800 p-2.5 rounded-lg">
                {formError}
              </p>
            )}

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Tên món ăn (*)</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ví dụ: Bún đậu mắm tôm"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mô tả phụ / Xuất xứ</label>
                <input
                  value={formSub}
                  onChange={e => setFormSub(e.target.value)}
                  placeholder="Ví dụ: Đậu giòn, chả cốm • Hà Nội"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Giá (nghìn VNĐ)</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={formPrice}
                    onChange={e => setFormPrice(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <span
                    className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded"
                    style={{
                      color: rarityColors[priceRarity(formPrice)],
                      backgroundColor: `${rarityColors[priceRarity(formPrice)]}22`,
                      border: `1px solid ${rarityColors[priceRarity(formPrice)]}66`
                    }}
                  >
                    Bậc: {rarityNames[priceRarity(formPrice)].split(' ')[0]}
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Chọn hình ảnh</label>
                  <div className="flex items-center gap-2">
                    <MiniFoodImage imageId={formImage} alt="Preview" size={38} />
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-2 px-2 rounded-lg border border-zinc-600 transition cursor-pointer"
                    >
                      Đổi ảnh (#{formImage})
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vegCheck"
                  checked={formVeg}
                  onChange={e => setFormVeg(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="vegCheck" className="text-zinc-300 text-xs cursor-pointer select-none">
                  Đây là món chay 🌱
                </label>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Câu thoại vui (khi quay trúng)</label>
                <input
                  value={formQuip}
                  onChange={e => setFormQuip(e.target.value)}
                  placeholder="Ví dụ: Ăn một lần là nhớ một đời."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setModalOpen(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveDish}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow cursor-pointer"
              >
                {editingIndex !== null ? 'Cập Nhật Món' : 'Thêm Vào Danh Sách'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Chọn Hình Ảnh Món Ăn</h3>
                <p className="text-xs text-zinc-400">Nhấp vào hình để chọn ảnh đại diện cho món</p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 overflow-y-auto p-1">
              {Array.from({ length: 132 }).map((_, id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFormImage(id);
                    setPickerOpen(false);
                  }}
                  className={`p-1 rounded-lg border flex flex-col items-center gap-1 transition cursor-pointer ${
                    formImage === id ? 'border-amber-500 bg-amber-950/40' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950'
                  }`}
                >
                  <MiniFoodImage imageId={id} alt={`Food ${id}`} size={44} />
                  <span className="text-[10px] text-zinc-400 font-mono">#{id}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-800 text-right">
              <button
                onClick={() => setPickerOpen(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
