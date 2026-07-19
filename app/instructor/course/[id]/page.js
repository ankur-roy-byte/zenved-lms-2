"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Shell from "@/components/Shell";
import { query, command, mediaCommand, uploadFile, probeVideoDuration, newIdempotencyKey } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, EmptyState, StatusChip, Modal, toast, fmtDuration } from "@/components/ui";
import { errorText } from "@/lib/errors";

/**
 * Course builder for instructors/admins: curriculum (modules → lessons,
 * VIDEO/ARTICLE/RESOURCE), video upload (presigned PUT → complete →
 * attach), per-lesson quiz editor, students, analytics, settings, and
 * submit-for-review. Publishing itself is admin-only.
 */
export default function CourseBuilderPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const [tab, setTab] = useState("curriculum");
  const { data: course, error, loading, reload } = useAsync(
    () => query("COURSE_DETAIL", { filters: { courseId } }), [courseId]);

  const submitForReview = async () => {
    try {
      const r = await command("SUBMIT_COURSE_FOR_REVIEW", { courseId });
      toast("Submitted for review — an admin will publish it. Status: " + r.status);
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <Shell role="INSTRUCTOR">
      {loading && <Spinner label="Loading course…" />}
      <ErrorNotice error={error} onRetry={reload} />
      {course && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <div>
              <Link href="/instructor" style={{ fontSize: 13.5, color: "var(--primary)" }}>← My courses</Link>
              <h1 className="page-title" style={{ marginTop: 4 }}>{course.title}</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <StatusChip value={course.status} />
                <StatusChip value={course.courseType} />
                <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>pass mark {course.passingPercentage}%</span>
              </div>
            </div>
            {(course.status === "DRAFT" || course.status === "UNPUBLISHED") && (
              <button className="btn btn-amber" onClick={submitForReview}>Submit for review →</button>
            )}
            {course.status === "IN_REVIEW" && (
              <span className="chip chip-amber">Awaiting admin review</span>
            )}
          </div>

          <div className="tabs">
            {[["curriculum", "Curriculum"], ["students", "Students"], ["analytics", "Analytics"], ["settings", "Settings"]].map(([k, l]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === "curriculum" && <Curriculum course={course} courseId={courseId} reload={reload} />}
          {tab === "students" && <StudentsTab courseId={courseId} />}
          {tab === "analytics" && <AnalyticsTab courseId={courseId} />}
          {tab === "settings" && <SettingsTab course={course} courseId={courseId} reload={reload} />}
        </>
      )}
    </Shell>
  );
}

// ═══════════════ curriculum ═══════════════
function Curriculum({ course, courseId, reload }) {
  const [newModule, setNewModule] = useState("");
  const [quizLesson, setQuizLesson] = useState(null); // lesson object being quiz-edited
  const [lessonModal, setLessonModal] = useState(null); // {moduleId, lesson?}

  const addModule = async () => {
    if (!newModule.trim()) return;
    try {
      await command("CREATE_MODULE", {
        courseId, title: newModule.trim(), description: null,
        displayOrder: (course.modules?.length || 0) + 1,
      });
      setNewModule("");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const deleteModule = async (m) => {
    if (!confirm(`Delete module “${m.title}” and all its lessons?`)) return;
    try {
      await command("DELETE_MODULE", { moduleId: m.moduleId });
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  const deleteLesson = async (l) => {
    if (!confirm(`Delete lesson “${l.title}”?`)) return;
    try {
      await command("DELETE_LESSON", { lessonId: l.lessonId });
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <>
      <div className="card" style={{ padding: 18, marginBottom: 18, display: "flex", gap: 10 }}>
        <input style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 10 }}
          placeholder="New module title…" value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addModule()} />
        <button className="btn btn-primary btn-sm" onClick={addModule}>+ Add module</button>
      </div>

      {(course.modules || []).length === 0 && (
        <EmptyState>No modules yet. A course needs at least one module with one lesson before it can be published.</EmptyState>
      )}

      {(course.modules || []).map((m) => (
        <div className="card" key={m.moduleId} style={{ marginBottom: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <h3 style={{ fontSize: 18 }}>{m.displayOrder}. {m.title}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLessonModal({ moduleId: m.moduleId })}>+ Lesson</button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => deleteModule(m)}>Delete</button>
            </div>
          </div>

          {m.lessons.length === 0 && <EmptyState>No lessons in this module yet.</EmptyState>}
          {m.lessons.map((l) => (
            <div key={l.lessonId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
              <span className="lesson-type" style={{ width: 68 }}>{l.lessonType}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b style={{ fontSize: 14.5 }}>{l.title}</b>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {l.isMandatory ? "mandatory" : "optional"}
                  {l.lessonType === "VIDEO" && (l.videoId
                    ? ` · video #${l.videoId} (${l.videoStatus}${l.durationSeconds ? ", " + fmtDuration(l.durationSeconds) : ""})`
                    : " · no video attached yet")}
                  {l.hasQuiz ? " · has quiz" : ""}
                </div>
              </div>
              {l.lessonType === "VIDEO" && (
                <VideoUploader courseId={courseId} lesson={l} onDone={reload} />
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setQuizLesson(l)}>
                {l.hasQuiz ? "Edit quiz" : "Add quiz"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setLessonModal({ moduleId: m.moduleId, lesson: l })}>Edit</button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => deleteLesson(l)}>✕</button>
            </div>
          ))}
        </div>
      ))}

      {lessonModal && (
        <LessonModal spec={lessonModal} onClose={() => setLessonModal(null)}
          onSaved={() => { setLessonModal(null); reload(); }} />
      )}
      {quizLesson && (
        <QuizEditorModal lesson={quizLesson} onClose={() => setQuizLesson(null)}
          onSaved={() => { setQuizLesson(null); reload(); }} />
      )}
    </>
  );
}

function LessonModal({ spec, onClose, onSaved }) {
  const editing = !!spec.lesson;
  const [form, setForm] = useState({
    title: spec.lesson?.title || "",
    description: spec.lesson?.description || "",
    lessonType: spec.lesson?.lessonType || "VIDEO",
    isMandatory: spec.lesson ? spec.lesson.isMandatory : true,
    contentText: "",
    displayOrder: spec.lesson?.displayOrder || 99,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  // Load existing contentText when editing an ARTICLE/RESOURCE lesson.
  useAsync(async () => {
    if (editing && spec.lesson.lessonType !== "VIDEO") {
      const d = await query("LESSON_DETAIL", { filters: { lessonId: spec.lesson.lessonId } });
      setForm((f2) => ({ ...f2, contentText: d.contentText || "" }));
    }
    return null;
  }, []);

  const save = async () => {
    if (!form.title.trim()) return toast("Lesson title is required.", "error");
    setBusy(true);
    try {
      if (editing) {
        await command("UPDATE_LESSON", {
          lessonId: spec.lesson.lessonId, title: form.title.trim(), description: form.description || null,
          displayOrder: Number(form.displayOrder) || null, isMandatory: form.isMandatory,
          lessonType: form.lessonType, contentText: form.lessonType === "VIDEO" ? null : form.contentText,
        });
      } else {
        await command("CREATE_LESSON", {
          moduleId: spec.moduleId, title: form.title.trim(), description: form.description || null,
          displayOrder: Number(form.displayOrder) || 1, isMandatory: form.isMandatory,
          lessonType: form.lessonType, contentText: form.lessonType === "VIDEO" ? null : form.contentText,
        });
      }
      toast(editing ? "Lesson updated." : "Lesson created.");
      onSaved();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={editing ? "Edit lesson" : "New lesson"} onClose={onClose}>
      <div className="field"><label>Title</label>
        <input value={form.title} onChange={set("title")} /></div>
      <div className="field"><label>Description</label>
        <input value={form.description} onChange={set("description")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Type</label>
          <select value={form.lessonType} onChange={set("lessonType")}>
            <option value="VIDEO">VIDEO — completed by watch time</option>
            <option value="ARTICLE">ARTICLE — mark as read</option>
            <option value="RESOURCE">RESOURCE — downloadable links</option>
          </select></div>
        <div className="field"><label>Order</label>
          <input type="number" value={form.displayOrder} onChange={set("displayOrder")} /></div>
      </div>
      {form.lessonType !== "VIDEO" && (
        <div className="field"><label>{form.lessonType === "ARTICLE" ? "Article content" : "Resource links & notes"}</label>
          <textarea rows={7} value={form.contentText} onChange={set("contentText")}
            style={{ padding: "11px 14px", border: "1px solid var(--line)", borderRadius: 10, font: "inherit", fontSize: 14.5 }}
            placeholder={form.lessonType === "ARTICLE" ? "Write the article text…" : "One URL per line, plus instructions…"} />
        </div>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5, marginBottom: 18, cursor: "pointer" }}>
        <input type="checkbox" checked={form.isMandatory} onChange={set("isMandatory")} style={{ accentColor: "var(--primary)" }} />
        Mandatory for course completion &amp; certificate
      </label>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create lesson"}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════ video upload (presign → PUT → complete → attach) ═══
function VideoUploader({ courseId, lesson, onDone }) {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null); // null | 0-100 | "processing"
  const [busy, setBusy] = useState(false);

  const start = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      return toast("Only MP4/WebM videos are allowed.", "error");
    }
    setBusy(true);
    setProgress(0);
    try {
      const durationSeconds = await probeVideoDuration(file);
      const idemKey = newIdempotencyKey();
      const issued = await mediaCommand("CREATE_VIDEO_UPLOAD_URL", {
        courseId, lessonId: lesson.lessonId, fileName: file.name,
        contentType: file.type, fileSizeBytes: file.size,
        durationSeconds: durationSeconds || null,
      }, { idempotencyKey: idemKey });

      await uploadFile(issued.uploadUrl, file, file.type, setProgress);
      setProgress("processing");

      await mediaCommand("COMPLETE_VIDEO_UPLOAD", {
        videoId: issued.videoId, s3Key: issued.s3Key,
        durationSeconds: durationSeconds || 1,
      }, { idempotencyKey: newIdempotencyKey() });

      await command("ATTACH_VIDEO_TO_LESSON", { lessonId: lesson.lessonId, videoId: issued.videoId });
      toast(`Video uploaded and attached to “${lesson.title}”.`);
      onDone();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const removeVideo = async () => {
    if (!confirm("Delete this video? Student watch progress for it is removed too.")) return;
    setBusy(true);
    try {
      await mediaCommand("DELETE_VIDEO", { videoId: lesson.videoId });
      toast("Video deleted.");
      onDone();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input ref={fileRef} type="file" accept="video/mp4,video/webm" style={{ display: "none" }} onChange={onFile} />
      {progress !== null ? (
        <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {progress === "processing" ? "Verifying…" : (
            <>
              <span className="bar" style={{ width: 90, display: "inline-block" }}>
                <span style={{ display: "block", height: "100%", width: progress + "%", background: "var(--primary)", borderRadius: 99 }} />
              </span>
              {progress}%
            </>
          )}
        </span>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={start}>
            {lesson.videoId ? "Replace video" : "⬆ Upload video"}
          </button>
          {lesson.videoId && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busy} onClick={removeVideo}>
              Delete video
            </button>
          )}
        </>
      )}
    </span>
  );
}

// ═══════════════ quiz editor ═══════════════
function QuizEditorModal({ lesson, onClose, onSaved }) {
  const existing = useAsync(async () => {
    if (!lesson.hasQuiz) return null;
    const d = await query("LESSON_DETAIL", { filters: { lessonId: lesson.lessonId } });
    if (!d.quiz) return null;
    return query("QUIZ_DETAIL", { filters: { quizId: d.quiz.quizId } });
  }, []);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  // Initialise the form once the existing quiz (or lack of one) is known.
  if (form === null && !existing.loading) {
    const q = existing.data;
    setForm(q ? {
      title: q.title, passingPercentage: q.passingPercentage, maxAttempts: q.maxAttempts,
      questions: q.questions.map((qq) => ({
        questionText: qq.questionText, questionType: qq.questionType, marks: qq.marks,
        options: qq.options.map((o) => ({ optionText: o.optionText, isCorrect: !!o.isCorrect })),
      })),
    } : {
      title: lesson.title + " — quiz", passingPercentage: 70, maxAttempts: 3,
      questions: [blankQuestion()],
    });
    return null;
  }
  if (form === null) return <Modal open title="Quiz" onClose={onClose}><Spinner /></Modal>;

  function blankQuestion() {
    return { questionText: "", questionType: "SINGLE_CORRECT", marks: 1,
      options: [{ optionText: "", isCorrect: true }, { optionText: "", isCorrect: false }] };
  }

  const setQ = (qi, patch) => setForm((f2) => ({
    ...f2,
    questions: f2.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)),
  }));
  const setOpt = (qi, oi, patch) => setForm((f2) => ({
    ...f2,
    questions: f2.questions.map((q, i) => i !== qi ? q : {
      ...q,
      options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)),
    }),
  }));
  const toggleCorrect = (qi, oi) => {
    const q = form.questions[qi];
    if (q.questionType === "SINGLE_CORRECT") {
      setQ(qi, { options: q.options.map((o, j) => ({ ...o, isCorrect: j === oi })) });
    } else {
      setOpt(qi, oi, { isCorrect: !q.options[oi].isCorrect });
    }
  };

  const save = async () => {
    for (const [i, q] of form.questions.entries()) {
      if (!q.questionText.trim()) return toast(`Question ${i + 1} needs text.`, "error");
      const opts = q.options.filter((o) => o.optionText.trim());
      if (opts.length < 2) return toast(`Question ${i + 1} needs at least 2 options.`, "error");
      const correct = opts.filter((o) => o.isCorrect).length;
      if (correct === 0) return toast(`Question ${i + 1} needs a correct option.`, "error");
      if (q.questionType === "SINGLE_CORRECT" && correct > 1)
        return toast(`Question ${i + 1} is single-choice but has ${correct} correct options.`, "error");
    }
    setBusy(true);
    try {
      await command("CREATE_OR_UPDATE_QUIZ", {
        lessonId: lesson.lessonId,
        title: form.title,
        passingPercentage: Number(form.passingPercentage),
        maxAttempts: Number(form.maxAttempts),
        questions: form.questions.map((q, qi) => ({
          questionText: q.questionText.trim(), questionType: q.questionType,
          marks: Number(q.marks) || 1, displayOrder: qi + 1,
          options: q.options.filter((o) => o.optionText.trim())
            .map((o) => ({ optionText: o.optionText.trim(), isCorrect: !!o.isCorrect })),
        })),
      });
      toast("Quiz saved. (Editing replaces the whole question set.)");
      onSaved();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open wide title={`Quiz for “${lesson.title}”`} onClose={onClose}>
      {lesson.hasQuiz && (
        <div className="notice">
          Saving replaces the entire question set. Past attempts keep an immutable
          snapshot of the quiz as it was when taken.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
        <div className="field"><label>Quiz title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="field"><label>Pass mark %</label>
          <input type="number" min={0} max={100} value={form.passingPercentage}
            onChange={(e) => setForm({ ...form, passingPercentage: e.target.value })} /></div>
        <div className="field"><label>Max attempts</label>
          <input type="number" min={1} value={form.maxAttempts}
            onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></div>
      </div>

      {form.questions.map((q, qi) => (
        <div className="card" key={qi} style={{ padding: 16, marginBottom: 14, boxShadow: "none" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 14 }}>Q{qi + 1}</b>
            <select value={q.questionType}
              onChange={(e) => {
                const t = e.target.value;
                const patch = { questionType: t };
                if (t === "SINGLE_CORRECT") {
                  let seen = false;
                  patch.options = q.options.map((o) => {
                    const keep = o.isCorrect && !seen;
                    if (o.isCorrect) seen = true;
                    return { ...o, isCorrect: keep };
                  });
                }
                setQ(qi, patch);
              }}
              style={{ padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13 }}>
              <option value="SINGLE_CORRECT">Single correct</option>
              <option value="MULTIPLE_CORRECT">Multiple correct</option>
            </select>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>Marks:</span>
            <input type="number" min={1} value={q.marks} onChange={(e) => setQ(qi, { marks: e.target.value })}
              style={{ width: 64, padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 8 }} />
            <span style={{ flex: 1 }} />
            {form.questions.length > 1 && (
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                onClick={() => setForm({ ...form, questions: form.questions.filter((_, i) => i !== qi) })}>
                Remove
              </button>
            )}
          </div>
          <div className="field"><label>Question</label>
            <input value={q.questionText} onChange={(e) => setQ(qi, { questionText: e.target.value })} /></div>
          {q.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input type={q.questionType === "SINGLE_CORRECT" ? "radio" : "checkbox"}
                checked={o.isCorrect} onChange={() => toggleCorrect(qi, oi)}
                title="Correct answer" style={{ accentColor: "var(--primary)" }} />
              <input value={o.optionText} placeholder={`Option ${oi + 1}`}
                onChange={(e) => setOpt(qi, oi, { optionText: e.target.value })}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 8, fontSize: 14 }} />
              {q.options.length > 2 && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setQ(qi, { options: q.options.filter((_, j) => j !== oi) })}>✕</button>
              )}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm"
            onClick={() => setQ(qi, { options: [...q.options, { optionText: "", isCorrect: false }] })}>
            + Option
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <button className="btn btn-ghost btn-sm"
          onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>
          + Add question
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save quiz"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════ students / analytics / settings ═══════════════
function StudentsTab({ courseId }) {
  const [page, setPage] = useState(0);
  const [report, setReport] = useState(null); // studentId being inspected
  const { data, error, loading, reload } = useAsync(
    () => query("COURSE_STUDENTS", { filters: { courseId }, pagination: { page, size: 20 } }), [courseId, page]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;

  return (
    <>
      <div className="card">
        <table className="data">
          <thead><tr><th>Student</th><th>Enrollment</th><th style={{ width: 240 }}>Progress</th><th /></tr></thead>
          <tbody>
            {(data?.content || []).map((s) => (
              <tr key={s.studentId}>
                <td><b>{s.name}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{s.email}</span></td>
                <td><StatusChip value={s.enrollmentStatus} /></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="bar" style={{ flex: 1 }}><div style={{ width: s.progressPercentage + "%" }} /></div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.progressPercentage}%</span>
                  </div>
                </td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setReport(s.studentId)}>Detail</button></td>
              </tr>
            ))}
            {(data?.content || []).length === 0 && (
              <tr><td colSpan={4} style={{ color: "var(--ink-soft)" }}>No students enrolled yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager pageData={data} onPage={setPage} />
      {report && <ProgressReportModal courseId={courseId} studentId={report} onClose={() => setReport(null)} />}
    </>
  );
}

function ProgressReportModal({ courseId, studentId, onClose }) {
  const { data, error, loading } = useAsync(
    () => query("STUDENT_PROGRESS_REPORT", { filters: { courseId, studentId } }), [courseId, studentId]);
  return (
    <Modal open wide title="Student progress report" onClose={onClose}>
      {loading && <Spinner />}
      <ErrorNotice error={error} />
      {data && (
        <>
          <div className="kv"><span>Student</span><b>{data.studentName} · {data.studentEmail}</b></div>
          <div className="kv"><span>Course progress</span>
            <b>{data.courseProgressPercentage}% ({data.completedLessons}/{data.totalLessons} lessons){data.courseCompleted ? " · completed ✓" : ""}</b></div>
          <h4 style={{ margin: "16px 0 8px", fontSize: 15 }}>Video watch time</h4>
          {data.videoProgress.length === 0 && <EmptyState>No videos watched yet.</EmptyState>}
          {data.videoProgress.map((v) => (
            <div className="kv" key={v.lessonId}>
              <span>Lesson #{v.lessonId}</span>
              <b>{v.totalWatchedSeconds}s watched · {v.progressPercentage}%{v.completed ? " ✓" : ""}</b>
            </div>
          ))}
          <h4 style={{ margin: "16px 0 8px", fontSize: 15 }}>Quizzes</h4>
          {data.quizProgress.length === 0 && <EmptyState>This course has no quizzes.</EmptyState>}
          {data.quizProgress.map((q) => (
            <div className="kv" key={q.quizId}>
              <span>{q.title}</span>
              <b>{q.attempts} attempt{q.attempts === 1 ? "" : "s"} · best {Number(q.bestScore).toFixed(0)}% · {q.passed ? "passed ✓" : "not passed"}</b>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

function AnalyticsTab({ courseId }) {
  const { data, error, loading, reload } = useAsync(
    () => query("COURSE_ANALYTICS", { filters: { courseId } }), [courseId]);
  if (loading) return <Spinner />;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!data) return null;
  const stats = [
    ["Enrolled (active)", data.totalEnrolled],
    ["Completed", data.completed],
    ["In progress", data.inProgress],
    ["Not started", data.notStarted],
    ["Avg quiz score", Number(data.averageQuizScore).toFixed(1) + "%"],
  ];
  return (
    <div className="course-grid">
      {stats.map(([label, value]) => (
        <div className="card stat" key={label}>
          <div className="num">{value}</div>
          <div className="lbl">{label}</div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ course, courseId, reload }) {
  const [form, setForm] = useState({
    title: course.title, description: course.description || "", category: course.category || "",
    level: course.level || "BEGINNER", language: course.language || "",
    passingPercentage: course.passingPercentage, courseType: course.courseType,
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await command("UPDATE_COURSE", {
        courseId, title: form.title, description: form.description || null,
        category: form.category || null, level: form.level || null, language: form.language || null,
        passingPercentage: Number(form.passingPercentage), courseType: form.courseType,
      });
      toast("Course settings saved.");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, maxWidth: 640 }}>
      <div className="field"><label>Title</label><input value={form.title} onChange={set("title")} /></div>
      <div className="field"><label>Description</label><input value={form.description} onChange={set("description")} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field"><label>Category</label><input value={form.category} onChange={set("category")} /></div>
        <div className="field"><label>Language</label><input value={form.language} onChange={set("language")} /></div>
        <div className="field"><label>Level</label>
          <select value={form.level} onChange={set("level")}>
            <option value="BEGINNER">BEGINNER</option>
            <option value="INTERMEDIATE">INTERMEDIATE</option>
            <option value="ADVANCED">ADVANCED</option>
          </select></div>
        <div className="field"><label>Access type</label>
          <select value={form.courseType} onChange={set("courseType")}>
            <option value="PAID">PAID (invite-only)</option>
            <option value="FREE">FREE (self-enrol)</option>
          </select></div>
        <div className="field"><label>Course pass mark (%)</label>
          <input type="number" min={0} max={100} value={form.passingPercentage} onChange={set("passingPercentage")} /></div>
      </div>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save settings"}
      </button>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 14 }}>
        Publishing, archiving and deletion are admin actions — submit the course for review
        from the header when the content is ready.
      </p>
    </div>
  );
}
