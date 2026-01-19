
import { TaskTemplate, UserProfile } from './types';

export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  { id: '1', name: 'Morning Meditation', points: 10 },
  { id: '2', name: 'Deep Work (2 Hours)', points: 20 },
  { id: '3', name: 'Physical Exercise', points: 15 },
  { id: '4', name: 'Read 10 Pages', points: 10 },
  { id: '5', name: 'Healthy Meal Prep', points: 15 },
  { id: '6', name: 'Evening Review', points: 5 },
];

export const INITIAL_PROFILE: UserProfile = {
  name: 'Alex Rivera',
  avatar: 'https://picsum.photos/id/64/200/200',
  totalPoints: 0,
  streak: 5,
};

export const ISLAMIC_CONTENT = [
  { dua: "Subhan-Allahi wa bihamdihi", meaning: "Glory be to Allah and His is the praise." },
  { dua: "Alhamdulillah", meaning: "Praise be to Allah." },
  { dua: "La ilaha illallah", meaning: "There is no god but Allah." },
  { dua: "Astaghfirullah", meaning: "I seek forgiveness from Allah." },
  { dua: "Hasbunallahu wa ni’mal wakil", meaning: "Sufficient for us is Allah, and [He is] the best Disposer of affairs." },
];

export const MOTIVATIONAL_QUOTES = [
  "Your only limit is your mind.",
  "Small daily improvements are the key to staggering long-term results.",
  "Focus on being productive instead of busy.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "The secret of getting ahead is getting started.",
];
