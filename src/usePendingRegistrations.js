import { useEffect, useRef, useState } from "react";
import { makeId } from "./storage";

export default function usePendingRegistrations(onCommit, onError) {
  const jobs = useRef(new Map()), callbacks = useRef({ onCommit, onError });
  callbacks.current = { onCommit, onError };
  const [pending, setPending] = useState([]);

  function publish() {
    setPending(Array.from(jobs.current.values(), ({ id, data, deadline }) => ({
      id, data, seconds: Math.max(1, Math.ceil((deadline - Date.now()) / 1000)),
    })));
  }

  function queue(data) {
    const id = makeId(), job = { id, data, deadline: Date.now() + 4000, timer: null };
    jobs.current.set(id, job);
    job.timer = setTimeout(() => {
      if (!jobs.current.delete(id)) return;
      publish();
      try { callbacks.current.onCommit(data); }
      catch (error) { callbacks.current.onError(error); }
    }, 4000);
    publish();
  }

  function cancel(id) {
    const job = jobs.current.get(id);
    if (!job) return false;
    clearTimeout(job.timer); jobs.current.delete(id); publish();
    return true;
  }

  useEffect(() => {
    if (!pending.length) return;
    const timer = setInterval(publish, 200);
    return () => clearInterval(timer);
  }, [pending.length > 0]);
  useEffect(() => () => {
    jobs.current.forEach((job) => clearTimeout(job.timer));
    jobs.current.clear();
  }, []);

  return { pending, queue, cancel };
}
