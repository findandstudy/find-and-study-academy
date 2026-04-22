import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import DOMPurify from "dompurify";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Check, Globe, PenLine, Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from "lucide-react";
import type { Content, ContentTranslation } from "@shared/schema";

const SUPPORTED_LANGUAGES = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
  { code: "kk", label: "Қазақша", flag: "🇰🇿" },
  { code: "az", label: "Azərbaycan", flag: "🇦🇿" },
];

function getAuthHeaders(): Record<string, string> {
  const raw = localStorage.getItem("fas_session");
  if (!raw) return {};
  try {
    const session = JSON.parse(raw);
    return { "x-user-id": session?.user?.id || "" };
  } catch {
    return {};
  }
}

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function RichEditor({ value, onChange, placeholder }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "İçeriği buraya yazın..." }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','h2','h3','a','blockquote','code','pre'], ALLOWED_ATTR: ['href','target'] }));
    },
  });

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-md text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Kalın">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="İtalik">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Başlık">
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Madde listesi">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numaralı liste">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Geri al">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Yeniden yap">
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 min-h-[200px] focus-within:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}

interface ContentTranslationEditorProps {
  content: Content;
  open: boolean;
  onClose: () => void;
}

export function ContentTranslationEditor({ content, open, onClose }: ContentTranslationEditorProps) {
  const { toast } = useToast();
  const [selectedLang, setSelectedLang] = useState("tr");
  const [form, setForm] = useState<{ title: string; description: string; content: string; status: string }>({
    title: "",
    description: "",
    content: "",
    status: "draft",
  });

  const { data: translationsData, isLoading } = useQuery<{ success: boolean; data: ContentTranslation[] }>({
    queryKey: ["/api/admin/contents", content.id, "translations"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contents/${content.id}/translations`, {
        headers: getAuthHeaders(),
      });
      return res.json();
    },
    enabled: open,
  });

  const translations = translationsData?.data || [];

  const loadTranslationToForm = useCallback((lang: string) => {
    const existing = translations.find(t => t.language === lang);
    if (existing) {
      setForm({
        title: existing.title || "",
        description: existing.description || "",
        content: existing.content || "",
        status: existing.status,
      });
    } else {
      setForm({ title: "", description: "", content: "", status: "draft" });
    }
  }, [translations]);

  const handleLangSelect = (lang: string) => {
    setSelectedLang(lang);
    loadTranslationToForm(lang);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sanitized = {
        ...form,
        content: DOMPurify.sanitize(form.content, {
          ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','h2','h3','a','blockquote','code','pre'],
          ALLOWED_ATTR: ['href','target']
        }),
      };
      const res = await fetch(`/api/admin/contents/${content.id}/translations/${selectedLang}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(sanitized),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents", content.id, "translations"] });
      const langLabel = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label || selectedLang;
      toast({ title: "Çeviri kaydedildi", description: `${langLabel} çevirisi başarıyla kaydedildi.` });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (lang: string) => {
      const res = await fetch(`/api/admin/contents/${content.id}/translations/${lang}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    },
    onSuccess: (_, lang) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents", content.id, "translations"] });
      toast({ title: "Çeviri silindi" });
      if (lang === selectedLang) {
        setForm({ title: "", description: "", content: "", status: "draft" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  const existingLangCodes = translations.map(t => t.language);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Çok Dilli İçerik Düzenleyici
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">{content.title}</span> için çeviri ekle veya düzenle
          </p>
        </DialogHeader>

        <div className="flex gap-4 mt-2">
          {/* Language selector panel */}
          <div className="w-44 shrink-0 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Diller</p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : (
              SUPPORTED_LANGUAGES.map(lang => {
                const hasTranslation = existingLangCodes.includes(lang.code);
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLangSelect(lang.code)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "hover-elevate text-foreground"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                    {hasTranslation && (
                      <Check className={`w-3 h-3 shrink-0 ${isSelected ? "text-primary-foreground" : "text-green-600"}`} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Editor panel */}
          <div className="flex-1 space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                {SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label} Çevirisi
              </h3>
              <div className="flex items-center gap-2">
                {existingLangCodes.includes(selectedLang) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(selectedLang)}
                    disabled={deleteMutation.isPending}
                    title="Bu çeviriyi sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="published">Yayında</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Başlık (boş bırakılırsa ana başlık kullanılır)</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={content.title}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Açıklama</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={content.description || "Açıklama..."}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">İçerik</Label>
                <RichEditor
                  key={`${content.id}-${selectedLang}`}
                  value={form.content}
                  onChange={html => setForm(f => ({ ...f, content: html }))}
                  placeholder={`${SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label} dilinde içerik yazın...`}
                />
              </div>
            </div>

            {/* Existing translations summary */}
            {translations.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Mevcut çeviriler</p>
                <div className="flex flex-wrap gap-2">
                  {translations.map(t => {
                    const lang = SUPPORTED_LANGUAGES.find(l => l.code === t.language);
                    return (
                      <Badge key={t.language} variant={t.status === "published" ? "default" : "secondary"}>
                        {lang?.flag} {lang?.label || t.language}
                        {t.status === "published" ? " · Yayında" : " · Taslak"}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kaydediliyor...</>
            ) : (
              <><Check className="w-4 h-4 mr-2" /> Çeviriyi Kaydet</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
