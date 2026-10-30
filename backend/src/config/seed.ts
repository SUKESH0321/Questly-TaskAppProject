import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Notification } from "../models/Notification.js";

export async function seedDatabase(): Promise<void> {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with initial data...");

  // Create users
  const user1 = await User.create({
    name: "Sukesh",
    email: "sukesh@example.com",
    phone: "+919000000001",
    phoneVerified: true,
    password: "password123",
    role: "customer",
    rating: 5.0,
  });

  const user2 = await User.create({
    name: "Sarah Jenkins",
    email: "sarah@example.com",
    phone: "+919000000002",
    phoneVerified: true,
    password: "password123",
    role: "tasker",
    rating: 4.9,
  });

  const user3 = await User.create({
    name: "Michael Chen",
    email: "michael@example.com",
    phone: "+919000000003",
    phoneVerified: true,
    password: "password123",
    role: "tasker",
    rating: 4.7,
  });

  // Create tasks
  await Task.create([
    {
      title: "Assemble IKEA Wardrobe",
      category: "Furniture Assembly",
      description:
        "Need help assembling a new IKEA wardrobe in my bedroom. Tools and instructions provided.",
      rating: 4.8,
      budget: 50,
      location: "123 Main St, New York",
      distance: "1.2 miles",
      time: "Today, 2:00 PM",
      date: "2026-07-13",
      imageUrl:
        "https://images.unsplash.com/photo-1595514535415-3bdc1b4d081e?q=80&w=600&auto=format&fit=crop",
      status: "open",
      posterId: user2._id,
      posterName: "Sarah Jenkins",
      posterAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
      posterRating: 4.9,
    },
    {
      title: "Deep Clean 2BHK Apartment",
      category: "Cleaning",
      description:
        "Need a thorough deep cleaning of my 2-bedroom apartment including bathrooms, kitchen and windows.",
      rating: 5.0,
      budget: 120,
      location: "456 Oak Ave, New York",
      distance: "0.8 miles",
      time: "Tomorrow, 9:00 AM",
      date: "2026-07-14",
      imageUrl:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=600&auto=format&fit=crop",
      status: "open",
      posterId: user3._id,
      posterName: "Michael Chen",
      posterAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704e",
      posterRating: 4.7,
    },
    {
      title: "Deliver Documents to Downtown",
      category: "Delivery",
      description:
        "Need someone to pick up and deliver important documents to downtown office.",
      rating: 4.5,
      budget: 25,
      location: "789 Pine Rd, New York",
      distance: "3.5 miles",
      time: "Within 2 hours",
      date: "2026-07-13",
      status: "open",
      posterId: user1._id,
      posterName: "Sukesh",
      posterRating: 5.0,
    },
    {
      title: "Fix Leaking Kitchen Sink",
      category: "Plumbing",
      description:
        "Kitchen sink is leaking under the cabinet. Need a plumber to fix it ASAP.",
      rating: 4.9,
      budget: 80,
      location: "321 Elm St, New York",
      distance: "2.1 miles",
      time: "Today, Any time",
      date: "2026-07-13",
      imageUrl:
        "https://images.unsplash.com/photo-1607472586893-edb57cb640d2?q=80&w=600&auto=format&fit=crop",
      status: "open",
      posterId: user1._id,
      posterName: "Sukesh",
      posterRating: 5.0,
    },
    {
      title: "Help Move Sofa",
      category: "Moving",
      description:
        "Need help moving a large sofa from second floor apartment to moving truck.",
      rating: 4.7,
      budget: 40,
      location: "654 Maple Dr, New York",
      distance: "5.0 miles",
      time: "Saturday, 10:00 AM",
      date: "2026-07-18",
      status: "open",
      posterId: user2._id,
      posterName: "Sarah Jenkins",
      posterAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704h",
      posterRating: 4.7,
    },
    {
      title: "Math Tutor for 10th Grader",
      category: "Tutoring",
      description:
        "Looking for a math tutor for my 10th grade son. Focus on algebra and geometry.",
      rating: 4.6,
      budget: 35,
      location: "987 Cedar Ln, New York",
      distance: "1.5 miles",
      time: "Weekly, Evenings",
      date: "2026-07-14",
      status: "open",
      posterId: user1._id,
      posterName: "Sukesh",
      posterRating: 5.0,
    },
  ]);

  // Create conversations
  const conv1 = await Conversation.create({
    participantIds: [user1._id, user2._id],
    lastMessage: "Sure, I can help with that! When are you available?",
    lastTime: "2m ago",
  });

  const conv2 = await Conversation.create({
    participantIds: [user1._id, user3._id],
    lastMessage: "I'll bring my own cleaning supplies",
    lastTime: "1h ago",
  });

  // Create messages
  await Message.create([
    {
      conversationId: conv1._id,
      senderId: user2._id,
      text: "Hi! I saw your task about deep cleaning.",
      time: "2:15 PM",
    },
    {
      conversationId: conv1._id,
      senderId: user1._id,
      text: "Yes, I need it done this weekend.",
      time: "2:16 PM",
    },
    {
      conversationId: conv1._id,
      senderId: user2._id,
      text: "Sure, I can help with that! When are you available?",
      time: "2:18 PM",
    },
    {
      conversationId: conv2._id,
      senderId: user3._id,
      text: "Hello! I'm interested in the cleaning task.",
      time: "1:00 PM",
    },
    {
      conversationId: conv2._id,
      senderId: user1._id,
      text: "Great! Do you have equipment?",
      time: "1:05 PM",
    },
    {
      conversationId: conv2._id,
      senderId: user3._id,
      text: "I'll bring my own cleaning supplies",
      time: "1:10 PM",
    },
  ]);

  // Create notifications
  await Notification.create([
    {
      userId: user1._id,
      type: "application",
      title: "New application received",
      description:
        "Sarah Jenkins applied for your 'Deep Clean 2BHK' task",
      time: "2 minutes ago",
      read: false,
    },
    {
      userId: user1._id,
      type: "message",
      title: "New message from Michael",
      description:
        "Michael Chen sent you a message about the cleaning task",
      time: "1 hour ago",
      read: false,
    },
    {
      userId: user1._id,
      type: "payment",
      title: "Payment confirmed",
      description:
        "₹50 payment for 'Assemble IKEA Wardrobe' has been released",
      time: "3 hours ago",
      read: false,
    },
    {
      userId: user1._id,
      type: "system",
      title: "Welcome to Questly!",
      description:
        "Thanks for joining! Complete your profile to get started.",
      time: "1 week ago",
      read: true,
    },
  ]);

  console.log("Database seeded successfully!");
}