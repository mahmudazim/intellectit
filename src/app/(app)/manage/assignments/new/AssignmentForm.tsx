"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2, TriangleAlert } from "lucide-react";

import { saveAssignmentAction, type AssignmentState } from "../actions";
import { LazyCodeEditor } from "@/components/editor/LazyCodeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

type Topic = { id: string; name: string; moduleName: string; difficulty: number };
type Group = { id: string; name: string };
type Student = { id: string; fullName: string };

type TestCaseRow = {
  key: string;
  stdin: string;
  expectedStdout: string;
  isHidden: boolean;
  points: number;
};

const newRow = (): TestCaseRow => ({
  key: Math.random().toString(36).slice(2),
  stdin: "",
  expectedStdout: "",
  isHidden: false,
  points: 1,
});

/** Telefonda uzun formani bo'lib ko'rsatish uchun yig'iladigan bo'lim. */
function Section({
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="font-semibold">{title}</span>
          {hint && (
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

function SaveButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2 md:flex-row-reverse">
      <Button
        type="submit"
        name="publish"
        value="1"
        size="block"
        disabled={pending}
      >
        {pending ? "Tekshirilmoqda..." : "Saqlash va berish"}
      </Button>
      <Button
        type="submit"
        name="publish"
        value="0"
        variant="outline"
        size="block"
        disabled={pending}
      >
        Qoralama sifatida saqlash
      </Button>
    </div>
  );
}

export function AssignmentForm({
  topics,
  groups,
  students,
}: {
  topics: Topic[];
  groups: Group[];
  students: Student[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<AssignmentState, FormData>(
    async (prev, formData) => {
      const result = await saveAssignmentAction(prev, formData);
      if (result.ok) router.push("/manage/assignments");
      return result;
    },
    {}
  );

  const [type, setType] = useState("CODE");
  const [language, setLanguage] = useState("python");
  const [starterCode, setStarterCode] = useState("");
  const [solutionCode, setSolutionCode] = useState("");
  const [rows, setRows] = useState<TestCaseRow[]>([newRow()]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  const isCode = type === "CODE";
  const editorLang = isCode ? language : type === "HTML_CSS" ? "html" : "python";

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <form action={formAction} className="space-y-4">
      {/* Client holatini serverga JSON sifatida uzatamiz */}
      <input
        type="hidden"
        name="testCases"
        value={JSON.stringify(
          rows
            .filter((r) => r.expectedStdout.trim() !== "")
            .map((r) => ({
              stdin: r.stdin,
              expectedStdout: r.expectedStdout,
              isHidden: r.isHidden,
              points: r.points,
            }))
        )}
      />
      <input type="hidden" name="groupIds" value={JSON.stringify(groupIds)} />
      <input type="hidden" name="studentIds" value={JSON.stringify(studentIds)} />
      <input type="hidden" name="starterCode" value={starterCode} />
      <input type="hidden" name="solutionCode" value={solutionCode} />

      <Section title="Asosiy ma'lumot">
        <div className="space-y-1.5">
          <Label htmlFor="title">Sarlavha</Label>
          <Input
            id="title"
            name="title"
            placeholder="Ikki sonning yig'indisi"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Vazifa sharti</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            placeholder={
              "Foydalanuvchidan ikkita butun son qabul qiling va ularning yig'indisini chiqaring.\n\nKirish: har qatorda bitta son\nChiqish: yig'indi"
            }
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Vazifa turi</Label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
            >
              <option value="CODE">Kod (avtomatik tekshiriladi)</option>
              <option value="HTML_CSS">HTML / CSS</option>
              <option value="TEXT">Matnli javob</option>
              <option value="PROJECT">Loyiha</option>
            </select>
          </div>

          {isCode && (
            <div className="space-y-1.5">
              <Label htmlFor="language">Dasturlash tili</Label>
              <select
                id="language"
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
              >
                <option value="python">Python</option>
              </select>
            </div>
          )}
          {!isCode && <input type="hidden" name="language" value="html" />}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="topicId">Mavzu</Label>
            <select
              id="topicId"
              name="topicId"
              required
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
            >
              <option value="" disabled>
                Tanlang...
              </option>
              {Object.entries(
                topics.reduce<Record<string, Topic[]>>((acc, t) => {
                  (acc[t.moduleName] ??= []).push(t);
                  return acc;
                }, {})
              ).map(([moduleName, list]) => (
                <optgroup key={moduleName} label={moduleName}>
                  {list.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="difficulty">Qiyinlik (1-5)</Label>
            <select
              id="difficulty"
              name="difficulty"
              defaultValue="2"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 md:h-9"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxPoints">Maksimal ball</Label>
            <Input
              id="maxPoints"
              name="maxPoints"
              type="number"
              inputMode="numeric"
              defaultValue={100}
              min={1}
              max={1000}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Boshlang'ich kod"
        hint="O'quvchi shu koddan boshlaydi (ixtiyoriy)"
        defaultOpen={false}
      >
        <LazyCodeEditor
          value={starterCode}
          onChange={setStarterCode}
          language={editorLang}
          minHeight="160px"
          ariaLabel="Boshlang'ich kod"
        />
      </Section>

      {isCode && (
        <>
          <Section
            title="To'g'ri yechim"
            hint="Saqlashdan oldin test-case'larda avtomatik tekshiriladi. O'quvchiga ko'rinmaydi."
          >
            <LazyCodeEditor
              value={solutionCode}
              onChange={setSolutionCode}
              language={editorLang}
              minHeight="160px"
              ariaLabel="To'g'ri yechim"
            />
          </Section>

          <Section
            title={`Test-case'lar (${rows.length})`}
            hint="Kirish va kutilgan chiqish. Yashirin testni o'quvchi ko'rmaydi."
          >
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div
                  key={row.key}
                  className="space-y-3 rounded-md border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Test {i + 1}</span>
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="O'chirish"
                        onClick={() =>
                          setRows((r) => r.filter((x) => x.key !== row.key))
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Kirish (stdin)</Label>
                      <Textarea
                        rows={3}
                        className="font-mono text-sm"
                        placeholder={"2\n3"}
                        value={row.stdin}
                        onChange={(e) =>
                          setRows((r) =>
                            r.map((x) =>
                              x.key === row.key
                                ? { ...x, stdin: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Kutilgan chiqish</Label>
                      <Textarea
                        rows={3}
                        className="font-mono text-sm"
                        placeholder="5"
                        value={row.expectedStdout}
                        onChange={(e) =>
                          setRows((r) =>
                            r.map((x) =>
                              x.key === row.key
                                ? { ...x, expectedStdout: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={row.isHidden}
                      onChange={(e) =>
                        setRows((r) =>
                          r.map((x) =>
                            x.key === row.key
                              ? { ...x, isHidden: e.target.checked }
                              : x
                          )
                        )
                      }
                    />
                    Yashirin test (o'quvchi kirish/chiqishni ko'rmaydi)
                  </label>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="block"
                onClick={() => setRows((r) => [...r, newRow()])}
              >
                <Plus aria-hidden /> Test qo'shish
              </Button>
            </div>
          </Section>
        </>
      )}

      <Section title="Kimga berish" hint="Guruh yoki alohida o'quvchilar">
        <div className="space-y-1.5">
          <Label htmlFor="dueAt">Topshirish muddati (ixtiyoriy)</Label>
          <Input id="dueAt" name="dueAt" type="datetime-local" />
        </div>

        {groups.length > 0 && (
          <div className="space-y-2">
            <Label>Guruhlar</Label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <label
                  key={g.id}
                  className={`flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                    groupIds.includes(g.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={groupIds.includes(g.id)}
                    onChange={() => setGroupIds((l) => toggle(l, g.id))}
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {students.length > 0 && (
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Alohida o'quvchilar ({studentIds.length} tanlangan)
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {students.map((s) => (
                <label
                  key={s.id}
                  className={`flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${
                    studentIds.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={studentIds.includes(s.id)}
                    onChange={() => setStudentIds((l) => toggle(l, s.id))}
                  />
                  {s.fullName}
                </label>
              ))}
            </div>
          </details>
        )}
      </Section>

      {state.error && (
        <div
          role="alert"
          className="flex gap-2 rounded-md bg-danger/10 px-3 py-3 text-sm text-danger"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <SaveButtons />
    </form>
  );
}
