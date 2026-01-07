"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@repo/ui";
import { FileText, Loader2, CheckCircle, XCircle, LogIn } from "lucide-react";
import Link from "next/link";

interface InviteInfo {
  email: string;
  permission: string;
  status: string;
  document: {
    id: string;
    title: string;
    icon: string | null;
  };
}

interface InviteAcceptClientProps {
  token: string;
  isLoggedIn: boolean;
  userEmail?: string;
}

export function InviteAcceptClient({
  token,
  isLoggedIn,
  userEmail,
}: InviteAcceptClientProps) {
  const router = useRouter();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 获取邀请详情
  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await fetch(
          `/api/editor-documents/collaborator-invite/${token}`
        );
        if (response.ok) {
          const data = await response.json();
          setInviteInfo(data);
        } else {
          const errorData = await response.json();
          setError(errorData.message || "邀请无效或已过期");
        }
      } catch {
        setError("无法加载邀请信息");
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  // 接受邀请
  const handleAccept = async () => {
    setAccepting(true);
    try {
      const response = await fetch(
        `/api/editor-documents/collaborator-invite/${token}`,
        { method: "POST" }
      );

      if (response.ok) {
        const data = await response.json();
        setSuccess(true);
        // 2秒后跳转到文档
        setTimeout(() => {
          router.push(`/editor/${data.documentId}`);
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "接受邀请失败");
      }
    } catch {
      setError("接受邀请失败，请重试");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">加载邀请信息...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="size-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">邀请无效</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button asChild>
            <Link href="/">返回首页</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="size-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">邀请已接受！</h1>
          <p className="text-muted-foreground mb-4">正在跳转到文档...</p>
          <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
        </Card>
      </div>
    );
  }

  // 邮箱不匹配
  const emailMismatch = isLoggedIn && userEmail !== inviteInfo?.email;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="size-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {inviteInfo?.document.icon ? (
              <span className="text-3xl">{inviteInfo.document.icon}</span>
            ) : (
              <FileText className="size-8 text-primary" />
            )}
          </div>
          <h1 className="text-xl font-semibold mb-2">文档协作邀请</h1>
          <p className="text-muted-foreground">您被邀请协作编辑以下文档</p>
        </div>

        <div className="bg-muted rounded-lg p-4 mb-6">
          <h2 className="font-medium mb-1">
            {inviteInfo?.document.title || "未命名文档"}
          </h2>
          <p className="text-sm text-muted-foreground">
            权限：{inviteInfo?.permission === "edit" ? "可编辑" : "仅查看"}
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              请先登录以接受此邀请
            </p>
            <p className="text-xs text-center text-muted-foreground">
              邀请发送至：{inviteInfo?.email}
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?redirect=/doc-invite/${token}`}>
                <LogIn className="size-4 mr-2" />
                登录
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href={`/register?redirect=/doc-invite/${token}`}>
                注册新账号
              </Link>
            </Button>
          </div>
        ) : emailMismatch ? (
          <div className="space-y-4">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-4 text-center">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                此邀请发送至 <strong>{inviteInfo?.email}</strong>
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                您当前登录的账号是 <strong>{userEmail}</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              请使用被邀请的邮箱账号登录以接受邀请
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link href={`/login?redirect=/doc-invite/${token}`}>
                切换账号
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              以 <strong>{userEmail}</strong> 身份接受邀请
            </p>
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  接受中...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  接受邀请
                </>
              )}
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link href="/">稍后再说</Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

