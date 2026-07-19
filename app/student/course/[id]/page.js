"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Shell from "@/components/Shell";
import { query, command, mediaCommand, trackingEvent, certificateDownloadUrl } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, Modal, StatusChip, toast, fmtDuration } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { IS_MOCK } from "@/lib/config";

const HEARTBEAT_INTERVAL_MS = 20_000; // backend expects one every 20–30s (rate limit 10/min/video)

export default function CoursePlayerPage() {
  const { id } = useParams();
  const courseId = Number(id);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [certOpen, setCertOpen] = useState(false);
  const { data: course, error, loading, reload } = useAsync(
    () => query("COURSE_DETAIL", { filters: { courseId } }), [courseId]);
  const myCerts = useAsync(() => query("MY_CERTIFICATES"), []);

  const lessons = (course?.modules || []).flatMap((m) => m.lessons);
  const current = lessons.find((l) => l.lessonId === selectedLessonId)
    || lessons.find((l) => !l.completed)
    || lessons[0];
  const existingCert = (myCerts.data || []).find((c) => c.courseId === courseId);
  const allDone = course?.progressPercentage === 100;

  return (
    <Shell role="STUDENT">
      {loading && <Spinner label="Loading course…" />}
      <ErrorNotice error={error} onRetry={reload} />
      {course && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <div>
              <Link href="/student" style={{ fontSize: 13.5, color: "var(--primary)" }}>← My learning</Link>
              <h1 className="page-title" style={{ marginTop: 4 }}>{course.title}</h1>
              <span style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                {course.category || "General"}{course.level ? ` · ${course.level}` : ""} · pass mark {course.passingPercentage}%
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
                Course progress · {course.progressPercentage}%
              </div>
              <div className="bar" style={{ width: 220 }}><div style={{ width: course.progressPercentage + "%" }} /></div>
            </div>
          </div>

          {course.contentUpdatedSinceCompletion && (
            <div className="notice">
              This course was updated after you completed it — new lessons were added.
              Your certificate stays valid; the new content is optional.
            </div>
          )}

          {allDone && !existingCert && (
            <div className="notice" style={{ background: "var(--primary-soft)", borderColor: "var(--primary-bright)", color: "var(--primary-deep)" }}>
              🎓 All lessons complete! If you have passed every quiz you can{" "}
              <button onClick={() => setCertOpen(true)}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 700, textDecoration: "underline", color: "inherit", cursor: "pointer" }}>
                generate your certificate
              </button>.
            </div>
          )}
          {existingCert && (
            <div className="notice" style={{ background: "var(--primary-soft)", borderColor: "var(--primary-bright)", color: "var(--primary-deep)" }}>
              🎓 Certificate issued —{" "}
              <Link href={`/certificate/${existingCert.certificateCode}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
                view it here
              </Link>
              {!IS_MOCK && existingCert.downloadUrl && (
                <> or <a href={certificateDownloadUrl(existingCert.downloadUrl)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, textDecoration: "underline" }}>download the PDF</a></>
              )}.
            </div>
          )}

          <div className="player-grid">
            <div>
              {current ? (
                <LessonView key={current.lessonId} courseId={courseId} lesson={current} onProgress={reload} />
              ) : (
                <p style={{ color: "var(--ink-soft)" }}>No lessons yet — the instructor is preparing content.</p>
              )}
            </div>

            <div className="card spine">
              {(course.modules || []).map((m) => (
                <div key={m.moduleId}>
                  <div style={{ padding: "12px 16px 6px", fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {m.title}
                  </div>
                  {m.lessons.map((l, i) => (
                    <div key={l.lessonId}
                      className={"spine-item" + (l.completed ? " done" : "") + (current?.lessonId === l.lessonId ? " active" : "")}
                      onClick={() => setSelectedLessonId(l.lessonId)}>
                      <div className="n">{l.completed ? "✓" : i + 1}</div>
                      <div>
                        <div className="t">{l.title}</div>
                        <div className="d">
                          <span className="lesson-type">{l.lessonType}</span>
                          {l.lessonType === "VIDEO" && l.durationSeconds ? ` · ${fmtDuration(l.durationSeconds)}` : ""}
                          {l.hasQuiz ? " · 📝 quiz" : ""}
                          {!l.isMandatory ? " · optional" : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 12 }}>{current?.lessonId === l.lessonId ? "▶" : ""}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <CertificateModal open={certOpen} onClose={() => setCertOpen(false)} courseId={courseId}
            onIssued={() => { setCertOpen(false); myCerts.reload(); }} />
        </>
      )}
    </Shell>
  );
}

// ── single lesson (video / article / resource + quiz) ───────
function LessonView({ courseId, lesson, onProgress }) {
  return (
    <>
      {lesson.lessonType === "VIDEO"
        ? <VideoLesson courseId={courseId} lesson={lesson} onProgress={onProgress} />
        : <TextLesson courseId={courseId} lesson={lesson} onProgress={onProgress} />}
      {lesson.hasQuiz && <QuizPanel lessonId={lesson.lessonId} />}
    </>
  );
}

function VideoLesson({ courseId, lesson, onProgress }) {
  const videoRef = useRef(null);
  const accumRef = useRef(0);       // valid watched seconds since last heartbeat
  const lastTimeRef = useRef(0);    // last observed playback position
  const [playback, setPlayback] = useState(null);
  const [playbackError, setPlaybackError] = useState(null);
  const [live, setLive] = useState({ completed: lesson.completed, pct: lesson.completed ? 100 : null });

  const loadPlayback = useCallback(async () => {
    if (!lesson.videoId) return;
    setPlaybackError(null);
    try {
      const result = await mediaCommand("GET_VIDEO_PLAYBACK_URL",
        { videoId: lesson.videoId, lessonId: lesson.lessonId, courseId });
      setPlayback(result);
    } catch (err) {
      setPlaybackError(err);
    }
  }, [courseId, lesson.lessonId, lesson.videoId]);

  useEffect(() => { loadPlayback(); }, [loadPlayback]);

  // Signed URLs expire — refresh shortly before, preserving position.
  useEffect(() => {
    if (!playback?.expiresInSeconds) return;
    const t = setTimeout(() => {
      const pos = videoRef.current?.currentTime || 0;
      loadPlayback().then(() => {
        requestAnimationFrame(() => { if (videoRef.current) videoRef.current.currentTime = pos; });
      });
    }, Math.max(30, playback.expiresInSeconds - 30) * 1000);
    return () => clearTimeout(t);
  }, [playback, loadPlayback]);

  const sendHeartbeat = useCallback(async (event = "VIDEO_HEARTBEAT") => {
    const v = videoRef.current;
    if (!v || !lesson.videoId) return;
    const delta = Math.round(accumRef.current);
    if (event === "VIDEO_HEARTBEAT" && delta <= 0) return;
    accumRef.current = 0;
    try {
      const result = await trackingEvent(event, {
        courseId,
        lessonId: lesson.lessonId,
        videoId: lesson.videoId,
        currentPositionSeconds: Math.floor(v.currentTime || 0),
        watchedDeltaSeconds: delta,
        playerDurationSeconds: Math.floor(v.duration || 0),
      });
      setLive({ completed: result.videoCompleted, pct: result.videoProgressPercentage });
      if (result.videoCompleted && !lesson.completed) onProgress();
    } catch {
      accumRef.current += delta; // resend with the next beat
    }
  }, [courseId, lesson, onProgress]);

  // Accumulate only genuine playback ticks (seeking doesn't count).
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const dt = v.currentTime - lastTimeRef.current;
    if (dt > 0 && dt < 2 && !v.paused && !v.seeking) accumRef.current += dt;
    lastTimeRef.current = v.currentTime;
  };

  useEffect(() => {
    const iv = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    return () => { clearInterval(iv); sendHeartbeat(); }; // flush on unmount/lesson switch
  }, [sendHeartbeat]);

  const resumeAt = playback?.lastWatchedSeconds || 0;

  return (
    <>
      {playbackError ? (
        <div className="card" style={{ padding: 28 }}>
          <ErrorNotice error={playbackError} onRetry={loadPlayback} />
        </div>
      ) : !playback ? (
        <div className="card" style={{ aspectRatio: "16/9", display: "grid", placeItems: "center" }}>
          <Spinner label="Fetching secure playback URL…" />
        </div>
      ) : (
        <video
          ref={videoRef}
          className="player"
          controls
          src={playback.playbackUrl}
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v && resumeAt > 0 && resumeAt < (v.duration || Infinity) - 2) {
              v.currentTime = resumeAt;
              lastTimeRef.current = resumeAt;
            }
          }}
          onTimeUpdate={onTimeUpdate}
          onPause={() => sendHeartbeat()}
          onEnded={async () => { await sendHeartbeat(); await sendHeartbeat("VIDEO_COMPLETED"); }}
        />
      )}

      <div className="card" style={{ padding: 18, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 16 }}>{lesson.title}</b>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
            {lesson.description || "Video lesson"} · completion needs ≥90% verified watch time
            {resumeAt > 0 && !live.completed ? ` · resumes at ${fmtDuration(resumeAt)}` : ""}
          </div>
        </div>
        {live.completed || lesson.completed ? (
          <span className="chip chip-green">✓ Completed</span>
        ) : (
          <span className="chip chip-gray">{live.pct != null ? `${live.pct}% watched` : "In progress"}</span>
        )}
      </div>
    </>
  );
}

function TextLesson({ courseId, lesson, onProgress }) {
  const [busy, setBusy] = useState(false);
  const detail = useAsync(() => query("LESSON_DETAIL", { filters: { lessonId: lesson.lessonId } }), [lesson.lessonId]);

  const markComplete = async () => {
    setBusy(true);
    try {
      await trackingEvent("MARK_LESSON_COMPLETE", { courseId, lessonId: lesson.lessonId });
      toast("Lesson marked as done.");
      onProgress();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <span className="chip chip-gray">{lesson.lessonType === "ARTICLE" ? "📖 Article" : "📎 Resource"}</span>
          <h2 style={{ fontSize: 22, margin: "10px 0 2px" }}>{lesson.title}</h2>
          {lesson.description && <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{lesson.description}</div>}
        </div>
        {lesson.completed
          ? <span className="chip chip-green" style={{ alignSelf: "flex-start" }}>✓ Done</span>
          : <button className="btn btn-primary btn-sm" disabled={busy} onClick={markComplete}>
              {busy ? "Saving…" : lesson.lessonType === "ARTICLE" ? "Mark as read" : "Mark as done"}
            </button>}
      </div>
      {detail.loading && <Spinner label="Loading content…" />}
      <ErrorNotice error={detail.error} onRetry={detail.reload} />
      {detail.data && (
        <div className="article-body">
          {linkify(detail.data.contentText || "No content added yet.")}
        </div>
      )}
    </div>
  );
}

/** Renders plain text, turning bare URLs into links. */
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>
      : <span key={i}>{part}</span>
  );
}

// ── quiz ────────────────────────────────────────────────────
function QuizPanel({ lessonId }) {
  const lessonDetail = useAsync(() => query("LESSON_DETAIL", { filters: { lessonId } }), [lessonId]);
  const quizId = lessonDetail.data?.quiz?.quizId;
  return (
    <div style={{ marginTop: 16 }}>
      {quizId ? <Quiz quizId={quizId} /> : null}
    </div>
  );
}

function Quiz({ quizId }) {
  const { data: quiz, error, loading, reload } = useAsync(
    () => query("QUIZ_DETAIL", { filters: { quizId } }), [quizId]);
  const [answers, setAnswers] = useState({}); // questionId -> Set(optionId)
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="card" style={{ padding: 22 }}><Spinner label="Loading quiz…" /></div>;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!quiz) return null;

  const attempts = quiz.myAttempts || [];
  const passed = attempts.some((a) => a.passed);
  const attemptsLeft = quiz.maxAttempts - attempts.length;

  const pick = (q, optionId) => {
    setAnswers((prev) => {
      const next = { ...prev };
      const set = new Set(next[q.questionId] || []);
      if (q.questionType === "SINGLE_CORRECT") {
        next[q.questionId] = new Set([optionId]);
      } else {
        set.has(optionId) ? set.delete(optionId) : set.add(optionId);
        next[q.questionId] = set;
      }
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        quizId: quiz.quizId,
        answers: quiz.questions.map((q) => ({
          questionId: q.questionId,
          selectedOptionIds: [...(answers[q.questionId] || [])],
        })),
      };
      const r = await command("SUBMIT_QUIZ_ATTEMPT", payload);
      setResult(r);
      setAnswers({});
      reload(); // refresh attempt history
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const optionText = (q, id) => q.options.find((o) => o.optionId === id)?.optionText || `#${id}`;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span className="chip chip-amber">📝 Quiz</span>
          <h2 style={{ fontSize: 21, margin: "8px 0 2px" }}>{quiz.title}</h2>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
            Pass mark {quiz.passingPercentage}% · {quiz.questions.length} questions ·{" "}
            {passed ? "passed ✓" : attemptsLeft > 0 ? `${attemptsLeft} of ${quiz.maxAttempts} attempts left` : "no attempts left"}
          </div>
        </div>
        {passed && <span className="chip chip-green">PASSED</span>}
      </div>

      {attempts.length > 0 && (
        <div style={{ margin: "14px 0 4px", fontSize: 13.5, color: "var(--ink-soft)" }}>
          Attempts:{" "}
          {attempts.map((a) => (
            <span key={a.attemptId} className={"chip " + (a.passed ? "chip-green" : "chip-gray")} style={{ marginRight: 6 }}>
              #{a.attemptNumber} · {Number(a.scorePercentage).toFixed(0)}%
            </span>
          ))}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="notice" style={result.passed
            ? { background: "var(--primary-soft)", borderColor: "var(--primary-bright)", color: "var(--primary-deep)" }
            : {}}>
            {result.passed ? "🎉 Passed" : "Not passed yet"} — score {Number(result.scorePercentage).toFixed(1)}%
            ({result.correctAnswers}/{result.totalQuestions} correct).
            {!result.passed && attemptsLeft - 1 > 0 ? " Review the answers below and try again." : ""}
          </div>
          {(result.review || []).map((r) => {
            const q = quiz.questions.find((x) => x.questionId === r.questionId);
            return (
              <div className="quiz-q" key={r.questionId}>
                <div className="qt">{r.correct ? "✅" : "❌"} {r.questionText}</div>
                <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                  Your answer: {r.selectedOptionIds.length ? r.selectedOptionIds.map((id) => optionText(q, id)).join(", ") : "—"}
                  {!r.correct && (
                    <><br />Correct: <b style={{ color: "var(--primary-deep)" }}>{r.correctOptionIds.map((id) => optionText(q, id)).join(", ")}</b></>
                  )}
                </div>
              </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setResult(null)}>
            {passed || attemptsLeft <= 0 ? "Close review" : "Try again"}
          </button>
        </div>
      )}

      {!result && !passed && attemptsLeft > 0 && (
        <div style={{ marginTop: 8 }}>
          {quiz.questions.map((q) => (
            <div className="quiz-q" key={q.questionId}>
              <div className="qt">
                {q.questionText}
                <span style={{ fontWeight: 400, fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {" "}· {q.marks} mark{q.marks > 1 ? "s" : ""}{q.questionType === "MULTIPLE_CORRECT" ? " · select all that apply" : ""}
                </span>
              </div>
              {q.options.map((o) => {
                const chosen = (answers[q.questionId] || new Set()).has(o.optionId);
                return (
                  <label className="quiz-opt" key={o.optionId}>
                    <input
                      type={q.questionType === "MULTIPLE_CORRECT" ? "checkbox" : "radio"}
                      name={"q" + q.questionId}
                      checked={chosen}
                      onChange={() => pick(q, o.optionId)}
                    />
                    <span>{o.optionText}</span>
                  </label>
                );
              })}
            </div>
          ))}
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit answers"}
          </button>
        </div>
      )}

      {!result && !passed && attemptsLeft <= 0 && (
        <div className="notice" style={{ marginTop: 14 }}>
          You have used all {quiz.maxAttempts} attempts. Contact your instructor if you believe this is a mistake.
        </div>
      )}
    </div>
  );
}

// ── certificate request (name double-confirm) ───────────────
function CertificateModal({ open, onClose, courseId, onIssued }) {
  const [name, setName] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    if (name.trim() && name !== confirmName) {
      setErr("The two name fields must match exactly — this name is printed permanently on your certificate.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const r = await command("GENERATE_CERTIFICATE", {
        courseId,
        recipientName: name.trim() || null,
        recipientNameConfirmation: name.trim() ? confirmName : null,
      });
      toast(`Certificate ${r.certificateCode} issued! 🎓`);
      onIssued(r);
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Generate your certificate" onClose={onClose}>
      <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginBottom: 16 }}>
        The name below is printed on the certificate and cannot be changed afterwards
        (an admin can re-issue in exceptional cases). Leave blank to use your account name.
      </p>
      <div className="field">
        <label>Name on certificate (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ananya Kulkarni" maxLength={150} />
      </div>
      {name.trim() && (
        <div className="field">
          <label>Confirm the name — type it again</label>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Repeat exactly" maxLength={150} />
        </div>
      )}
      {err && <p style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }} role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={generate}>
          {busy ? "Generating…" : "Generate certificate 🎓"}
        </button>
      </div>
    </Modal>
  );
}
