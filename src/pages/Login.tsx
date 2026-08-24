import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { t } from "@/lib/lang";

// ---------- Ronin Wallet (extension / in-app browser) — EIP-1193 ----------
type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Ronin Wallet inject window.ronin; hỗ trợ cả EIP-6963 announce. */
function findRoninProvider(): Eip1193 | null {
  const w = window as unknown as Record<string, any>;
  if (w.ronin?.provider?.request) return w.ronin.provider as Eip1193;
  if (w.ronin?.roninProvider?.request) return w.ronin.roninProvider as Eip1193;
  if (w.ronin?.request) return w.ronin as Eip1193;
  return (w.__eip6963_ronin as Eip1193 | undefined) ?? null;
}

// Lắng nghe EIP-6963 (ví hiện đại announce thay vì ghi đè window)
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (ev) => {
    const detail = (ev as CustomEvent).detail;
    if (detail?.info?.rdns === "com.roninchain.wallet" && detail?.provider) {
      (window as any).__eip6963_ronin = detail.provider;
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const nonceMut = trpc.wallet.nonce.useMutation();
  const verifyMut = trpc.wallet.verify.useMutation();
  const googleMut = trpc.google.login.useMutation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const cfgQuery = trpc.config.useQuery(undefined, { staleTime: Infinity, retry: false });
  const localOnly = !!cfgQuery.data?.localOnly;

  // ---------- Google Identity Services ----------
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    let cancelled = false;

    function renderBtn() {
      const g = (window as any).google?.accounts?.id;
      if (!g || cancelled || !googleBtnRef.current) return;
      g.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return;
          setBusy(true);
          setStatus("");
          try {
            const r = await googleMut.mutateAsync({ credential: resp.credential });
            if (!r.ok) {
              setStatus(
                r.error === "google_not_configured"
                  ? "Server chưa cấu hình GOOGLE_CLIENT_ID."
                  : "Đăng nhập Google thất bại — thử lại.",
              );
              return;
            }
            await utils.auth.me.invalidate();
            navigate("/");
          } catch {
            setStatus("Đăng nhập Google thất bại — thử lại.");
          } finally {
            setBusy(false);
          }
        },
      });
      g.renderButton(googleBtnRef.current, {
        theme: "filled_black",
        size: "large",
        width: 360,
        text: "signin_with",
        locale: "vi",
      });
    }

    if ((window as any).google?.accounts?.id) {
      renderBtn();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = renderBtn;
    s.onerror = () => setStatus("Không tải được Google Identity — kiểm tra mạng.");
    document.head.appendChild(s);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loginRonin() {
    setStatus("");
    const provider = findRoninProvider();
    if (!provider) {
      setStatus("Chưa cài Ronin Wallet — đang mở trang cài đặt…");
      window.open("https://wallet.roninchain.com", "_blank");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts?.[0];
      if (!address) throw new Error("Ví không trả về địa chỉ nào.");
      const n = await nonceMut.mutateAsync({ address });
      if (!n.ok) throw new Error("Không lấy được nonce đăng nhập.");
      const signature = (await provider.request({
        method: "personal_sign",
        params: [n.message, address],
      })) as string;
      const v = await verifyMut.mutateAsync({ address, signature });
      if (!v.ok) {
        const reason =
          v.error === "nonce_expired" ? "Phiên đăng nhập hết hạn — thử lại."
          : v.error === "bad_signature" ? "Chữ ký không hợp lệ."
          : "Đăng nhập thất bại.";
        throw new Error(reason);
      }
      await utils.auth.me.invalidate();
      navigate("/");
    } catch (e: any) {
      if (e?.code === 4001) setStatus("Bạn đã từ chối yêu cầu trong ví.");
      else setStatus(e?.message || "Đăng nhập Ronin thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14100c] px-4">
      {localOnly ? (
        <Card className="w-full max-w-md border-[#5a4a32] bg-[#1d1712]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-[#f0d68a]">
              ⚔ Giang Hồ Huyễn Ảnh
            </CardTitle>
            <p className="mt-1 text-sm text-[#a89980]">{t("offlineSub")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full bg-[#c9a227] font-bold text-[#1a1408] hover:bg-[#e0b832]"
              size="lg"
              onClick={() => navigate("/")}
            >
              {t("playNow")}
            </Button>
            <p className="pt-1 text-center text-xs text-[#8a7a60]">
              {t("offlineNote")}
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card className="w-full max-w-md border-[#5a4a32] bg-[#1d1712]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#f0d68a]">
            ⚔ Giang Hồ Huyễn Ảnh
          </CardTitle>
          <p className="mt-1 text-sm text-[#a89980]">{t("cloudSub")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
            size="lg"
            disabled={busy}
            onClick={loginRonin}
          >
            {busy ? t("roninBusy") : t("roninBtn")}
          </Button>

          {GOOGLE_CLIENT_ID ? (
            <div className="flex justify-center overflow-hidden rounded">
              <div ref={googleBtnRef} />
            </div>
          ) : (
            <Button
              className="w-full bg-[#3a2f22] text-[#8a7a60] cursor-not-allowed"
              size="lg"
              disabled
              title="Cần VITE_GOOGLE_CLIENT_ID trong .env.local (tạo ở Google Cloud Console)"
            >
              {t("googleOff")}
            </Button>
          )}

          {status && (
            <p className="rounded border border-[#5a4a32] bg-[#14100c] p-2 text-center text-xs text-[#e8b04a]">
              {status}
            </p>
          )}

          <p className="pt-1 text-center text-xs text-[#8a7a60]">
            <Link to="/" className="underline hover:text-[#f0d68a]">
              Chơi ngay không cần đăng nhập
            </Link>{" "}
            — save chỉ lưu trong trình duyệt
          </p>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
