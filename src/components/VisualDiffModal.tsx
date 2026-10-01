import { useState, useEffect, useRef } from "react";
import { vfsHistory, type VfsSnapshot } from "../lib/vfs/vfsHistory";
import type { VirtualFile } from "../lib/storage";

export interface DiffHunk {
  type: "added" | "deleted" | "context" | "unchanged";
  lines: string[];
  lineNumbers: { old?: number; new?: number }[];
}

export interface VisualDiffProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  snapshots: VfsSnapshot[];
  currentContent: string;
  onAcceptHunk: (hunk: DiffHunk) => void;
  onRollback: () => void;
}

export function VisualDiffModal({
  isOpen,
  onClose,
  filePath,
  snapshots,
  currentContent,
  onAcceptHunk,
  onRollback,
}: VisualDiffProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<VfsSnapshot | null>(null);
  const [diffResult, setDiffResult] = useState<{ oldContent: string; newContent: string; hunks: DiffHunk[] } | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || snapshots.length === 0) {
      setSelectedSnapshot(null);
      setDiffResult(null);
      return;
    }
    setSelectedSnapshot(snapshots[0]);
  }, [isOpen, snapshots, filePath]);

  useEffect(() => {
    async function computeDiff() {
      if (!selectedSnapshot) {
        setDiffResult(null);
        return;
      }
      try {
        const snapshotFiles = selectedSnapshot.files || [];
        const oldFile = snapshotFiles.find(f => f.path === filePath);
        const oldContent = oldFile?.content || "";
        const hunks = computeHunks(oldContent, currentContent);
        setDiffResult({ oldContent, newContent: currentContent, hunks });
      } catch {
        setDiffResult(null);
      }
    }
    if (selectedSnapshot) void computeDiff();
  }, [selectedSnapshot, filePath, currentContent]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const delta = startX - currentX;
    if (Math.abs(delta) > 50) {
      if (delta > 50 && swipeIndex < snapshots.length - 1) {
        setSwipeIndex(swipeIndex + 1);
        setStartX(currentX);
      } else if (delta < -50 && swipeIndex > 0) {
        setSwipeIndex(swipeIndex - 1);
        setStartX(currentX);
      }
    }
  };

  const handleTouchEnd = () => setIsSwiping(false);

  const handleSwipe = (direction: "prev" | "next") => {
    if (direction === "next" && swipeIndex < snapshots.length - 1) setSwipeIndex(swipeIndex + 1);
    else if (direction === "prev" && swipeIndex > 0) setSwipeIndex(swipeIndex - 1);
  };

  const handleAcceptAll = () => {
    if (diffResult) {
      for (const hunk of diffResult.hunks) {
        if (hunk.type === "added") onAcceptHunk(hunk);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content diff-modal" onClick={(e) => e.stopPropagation()} ref={swipeRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="diff-header">
          <h2>Visual Diff: {filePath}</h2>
          <div className="diff-navigation">
            <button className="diff-nav-button" type="button" onClick={() => handleSwipe("prev")} disabled={swipeIndex === 0}>PREV</button>
            <span className="diff-counter">{swipeIndex + 1} / {snapshots.length}</span>
            <button className="diff-nav-button" type="button" onClick={() => handleSwipe("next")} disabled={swipeIndex === snapshots.length - 1}>NEXT</button>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>X</button>
        </div>

        <div className="diff-summary">
          {diffResult && (
            <>
              <span className="diff-stat">{diffResult.hunks.filter(h => h.type === "added").length} additions</span>
              <span className="diff-stat">{diffResult.hunks.filter(h => h.type === "deleted").length} deletions</span>
              <span className="diff-stat">{diffResult.hunks.filter(h => h.type === "context").length} context</span>
            </>
          )}
        </div>

        <div className="diff-view">
          {diffResult ? (
            <div className="diff-split-view">
              <div className="diff-panel diff-panel-old">
                <div className="diff-panel-header"><span className="diff-panel-label">Previous ({selectedSnapshot?.label || "Snapshot"})</span></div>
                <div className="diff-content">
                  {diffResult.hunks.map((hunk, index) => (
                    <div key={index} className={`diff-hunk ${hunk.type}`}>
                      <div className="diff-hunk-header">
                        <span className="diff-hunk-indicator">{hunk.type === "added" ? "+" : hunk.type === "deleted" ? "-" : " "}</span>
                        <span className="diff-hunk-info">
                          {hunk.lineNumbers[0]?.old ? `@@ -${hunk.lineNumbers[0].old} ${hunk.lines.length > 1 ? `,${hunk.lineNumbers[hunk.lineNumbers.length - 1]?.old}` : ""} @@` :
                           hunk.lineNumbers[0]?.new ? `@@ +${hunk.lineNumbers[0].new} ${hunk.lines.length > 1 ? `,${hunk.lineNumbers[hunk.lineNumbers.length - 1]?.new}` : ""} @@` : ""}
                        </span>
                      </div>
                      <div className="diff-hunk-lines">
                        {hunk.lines.map((line, lineIndex) => (
                          <div key={lineIndex} className={`diff-line ${hunk.type}`}>
                            <span className="diff-line-prefix">{hunk.type === "deleted" ? "-" : " "}</span>
                            <span className="diff-line-content">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="diff-panel diff-panel-new">
                <div className="diff-panel-header"><span className="diff-panel-label">Current</span></div>
                <div className="diff-content">
                  {diffResult.hunks.map((hunk, index) => (
                    <div key={index} className={`diff-hunk ${hunk.type}`}>
                      <div className="diff-hunk-header">
                        <span className="diff-hunk-indicator">{hunk.type === "added" ? "+" : hunk.type === "deleted" ? "-" : " "}</span>
                        <span className="diff-hunk-info">{hunk.lineNumbers[0]?.new ? `@@ +${hunk.lineNumbers[0].new} ${hunk.lines.length > 1 ? `,${hunk.lineNumbers[hunk.lineNumbers.length - 1]?.new}` : ""} @@` : ""}</span>
                      </div>
                      <div className="diff-hunk-lines">
                        {hunk.lines.map((line, lineIndex) => (
                          <div key={lineIndex} className={`diff-line ${hunk.type}`}>
                            <span className="diff-line-prefix">{hunk.type === "added" ? "+" : " "}</span>
                            <span className="diff-line-content">{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : <div className="diff-loading"><p>Computing diff...</p></div>}
        </div>

        <div className="diff-actions">
          <button className="secondary-button" type="button" onClick={onRollback}>Rollback to Snapshot</button>
          <button className="secondary-button" type="button" onClick={handleAcceptAll}>Accept All Changes</button>
          <button className="primary-button" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function computeHunks(oldContent: string, newContent: string): DiffHunk[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const hunks: DiffHunk[] = [];
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let end = 0;
  while (end < oldLines.length - start && end < newLines.length - start && oldLines[oldLines.length - 1 - end] === newLines[newLines.length - 1 - end]) end++;
  const contextLines = 3;
  if (start > contextLines) {
    hunks.push({
      type: "unchanged",
      lines: oldLines.slice(0, start - contextLines),
      lineNumbers: Array.from({ length: start - contextLines }, (_, i) => ({ old: i + 1, new: i + 1 })),
    });
  }
  const deletedLines = oldLines.slice(start, oldLines.length - end);
  if (deletedLines.length > 0) {
    hunks.push({
      type: "deleted",
      lines: deletedLines,
      lineNumbers: Array.from({ length: deletedLines.length }, (_, i) => ({ old: start + i + 1 })),
    });
  }
  const addedLines = newLines.slice(start, newLines.length - end);
  if (addedLines.length > 0) {
    hunks.push({
      type: "added",
      lines: addedLines,
      lineNumbers: Array.from({ length: addedLines.length }, (_, i) => ({ new: start + i + 1 })),
    });
  }
  if (end > contextLines) {
    const unchangedLines = oldLines.slice(oldLines.length - end + contextLines);
    hunks.push({
      type: "unchanged",
      lines: unchangedLines,
      lineNumbers: Array.from({ length: unchangedLines.length }, (_, i) => ({ old: oldLines.length - end + contextLines + i + 1, new: newLines.length - end + contextLines + i + 1 })),
    });
  }
  return hunks;
}
