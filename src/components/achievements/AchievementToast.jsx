import { motion, AnimatePresence } from "framer-motion";

export default function AchievementToast({ achievements }) {
  return (
    <AnimatePresence>
      {achievements?.map((item) => (
        <motion.div
          key={item.id}
          className="achievement-toast"
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
        >
          <span>{item.icon}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.desc}</p>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}