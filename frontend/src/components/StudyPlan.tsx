import { useRef, useState, type FormEvent } from 'react';
import { requestStudyTask, type StudyPlanEvent } from '../api/studyPlanSocket';
import type { Assignment } from '../types';

export default function StudyPlan({ assignments }: { assignments: Assignment[] }) {
  const [assignmentId, setAssignmentId] = useState('');
  const [difficultTopic, setDifficultTopic] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [task, setTask] = useState('');
  const [source, setSource] = useState<'model' | 'template' | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef<(() => void) | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assignment = assignments.find((item) => item.id === assignmentId);
    if (!assignment || !difficultTopic.trim()) return;

    closeRef.current?.();
    setTask('');
    setSource(null);
    setError('');
    setStreaming(true);

    closeRef.current = requestStudyTask(
      { assignmentTitle: assignment.title, difficultTopic: difficultTopic.trim(), minutes },
      {
        onEvent: (event: StudyPlanEvent) => {
          if (event.type === 'chunk') setTask((current) => current + event.text);
          else if (event.type === 'done') { setSource(event.source); setStreaming(false); }
          else if (event.type === 'error') { setError(event.message); setStreaming(false); }
        },
        onClose: () => setStreaming(false),
      },
    );
  }

  return (
    <section>
      <h2>One study task</h2>
      <form onSubmit={submit}>
        <label>
          Assignment
          <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)} required>
            <option value="" disabled>Choose an assignment</option>
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
            ))}
          </select>
        </label>
        <label>
          What's difficult about it?
          <input
            type="text"
            value={difficultTopic}
            onChange={(event) => setDifficultTopic(event.target.value)}
            maxLength={300}
            required
          />
        </label>
        <label>
          Minutes available (5-25)
          <input
            type="number"
            min={5}
            max={25}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
        <button disabled={streaming || !assignmentId}>{streaming ? 'Thinking…' : 'Get one task'}</button>
      </form>
      {task && (
        <p role="status">
          {task}
          {source && <em> ({source === 'model' ? 'AI-generated' : 'template'})</em>}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
