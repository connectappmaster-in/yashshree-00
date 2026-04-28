import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Users, Star, Award, BookOpen, Phone, MessageCircle, MapPin, ChevronRight, Shield, Target, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yashshree Coaching Classes — Admission Open 2026-27" },
      { name: "description", content: "Best coaching classes in Shivane, Pune for 8th-10th SSC/CBSE, 11th-12th Commerce & Science. Experienced teachers, personal guidance, best results." },
      { property: "og:title", content: "Yashshree Coaching Classes — Admission Open 2026-27" },
      { property: "og:description", content: "Best coaching classes in Shivane, Pune. SSC/CBSE, Commerce & Science." },
    ],
  }),
  component: LandingPage,
});

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count}{suffix}</span>;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-secondary" />
            <span className="font-display font-bold text-lg">Yashshree Coaching Classes</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#home" className="hover:text-secondary transition-colors">Home</a>
            <a href="#courses" className="hover:text-secondary transition-colors">Courses</a>
            <a href="#features" className="hover:text-secondary transition-colors">Features</a>
            <a href="#contact" className="hover:text-secondary transition-colors">Contact</a>
          </nav>
          <Link to="/login">
            <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold">
              Admin Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-secondary blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-slide-up">
              <span className="inline-block bg-secondary text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-bold">
                🎓 Admission Open 2026-27
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight">
                Yashshree<br />
                <span className="text-secondary">Coaching Classes</span>
              </h1>
              <div className="space-y-3 text-lg text-primary-foreground/80">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-secondary" />
                  <span>8th, 9th, 10th — SSC / CBSE</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-secondary" />
                  <span>11th, 12th — Commerce</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-secondary" />
                  <span>11th, 12th — Science</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <a href="#contact">
                  <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold text-base">
                    <Phone className="h-4 w-4 mr-2" />
                    Contact Us
                  </Button>
                </a>
                <a href="#courses">
                  <Button size="lg" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-2 border-primary-foreground/40 font-bold text-base">
                    View Courses
                  </Button>
                </a>
              </div>
            </div>
            {/* Hero Illustration */}
            <div className="hidden md:flex justify-center">
              <div className="relative w-80 h-80">
                {/* Background circles */}
                <div className="absolute inset-0 rounded-full bg-secondary/10 animate-pulse" />
                <div className="absolute inset-6 rounded-full bg-secondary/15" />
                <div className="absolute inset-12 rounded-full bg-primary-foreground/5 border-2 border-secondary/30 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <GraduationCap className="h-20 w-20 text-secondary mx-auto" />
                    <div className="space-y-1">
                      <p className="text-2xl font-display font-bold text-secondary">Since 2015</p>
                      <p className="text-xs text-primary-foreground/60 font-medium">Shaping Futures</p>
                    </div>
                  </div>
                </div>
                {/* Floating icons */}
                <div className="absolute top-4 right-4 h-12 w-12 rounded-xl bg-secondary/20 flex items-center justify-center animate-bounce" style={{ animationDelay: "0.5s" }}>
                  <BookOpen className="h-6 w-6 text-secondary" />
                </div>
                <div className="absolute bottom-8 left-2 h-10 w-10 rounded-lg bg-accent/30 flex items-center justify-center animate-bounce" style={{ animationDelay: "1s" }}>
                  <Star className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="absolute top-16 left-0 h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center animate-bounce" style={{ animationDelay: "1.5s" }}>
                  <Award className="h-5 w-5 text-success" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Counter */}
      <section className="bg-secondary py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 500, suffix: "+", label: "Students Taught", icon: Users },
              { value: 10, suffix: "+", label: "Years Experience", icon: Clock },
              { value: 95, suffix: "%", label: "Board Results", icon: TrendingUp },
              { value: 15, suffix: "+", label: "Expert Teachers", icon: GraduationCap },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <stat.icon className="h-6 w-6 mx-auto text-primary mb-1" />
                <p className="text-3xl md:text-4xl font-display font-bold text-secondary-foreground">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs md:text-sm font-medium text-secondary-foreground/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="py-16 md:py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">Our Courses</h2>
            <p className="mt-3 text-muted-foreground text-lg">Comprehensive coaching for all boards and streams</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <CourseCard
              title="SSC / CBSE / ICSE / IB"
              classes="5th – 10th"
              icon={BookOpen}
              subjects={["Mathematics", "Science", "English", "Social Science"]}
              color="bg-gradient-to-br from-primary to-primary/80"
            />
            <CourseCard
              title="Commerce"
              classes="11th, 12th"
              icon={Target}
              subjects={["Accountancy", "Economics", "Secretarial Practice", "Organisation of Commerce"]}
              color="bg-gradient-to-br from-accent to-accent/80"
              badge="Morning & Evening Batches"
            />
            <CourseCard
              title="Science"
              classes="11th, 12th"
              icon={Award}
              subjects={["Physics", "Chemistry", "Mathematics", "Biology"]}
              color="bg-gradient-to-br from-primary to-primary/80"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">Why Choose Us?</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "Experienced Teachers", desc: "Qualified and experienced faculty dedicated to student success" },
              { icon: Shield, title: "Limited Admissions", desc: "Small batch sizes for personalized attention to every student" },
              { icon: Target, title: "Personal Guidance", desc: "Individual mentoring and doubt-clearing sessions" },
              { icon: Award, title: "Best Results", desc: "Proven track record of excellent board exam results" },
              { icon: BookOpen, title: "Board Exam Preparation", desc: "Specialized preparation for SSC, CBSE and university exams" },
              { icon: Star, title: "Holistic Development", desc: "Focus on conceptual clarity and exam techniques" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl p-6 shadow-sm border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 md:py-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Contact Us</h2>
            <p className="mt-3 text-primary-foreground/70 text-lg">Get in touch for admissions and inquiries</p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
            <div className="space-y-6">
              <div className="flex gap-4">
                <MapPin className="h-6 w-6 text-secondary shrink-0 mt-1" />
                <div>
                  <h3 className="font-display font-bold text-lg">Address</h3>
                  <p className="text-primary-foreground/80 mt-1">
                    Kamte Plaza, Jayhind Chowk,<br />
                    Pandharinath Complex Samor,<br />
                    Shivane, Pune - 23
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="h-6 w-6 text-secondary shrink-0 mt-1" />
                <div>
                  <h3 className="font-display font-bold text-lg">Mobile</h3>
                  <p className="text-primary-foreground/80 mt-1">
                    9405402865 / 9850740805
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <a href="tel:9405402865" className="w-full">
                <Button size="lg" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-bold text-base">
                  <Phone className="h-5 w-5 mr-2" />
                  Call Now
                </Button>
              </a>
              <a href="https://wa.me/919405402865?text=Hello%2C%20I%20want%20to%20know%20about%20admissions" target="_blank" rel="noopener noreferrer" className="w-full">
                <Button size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90 font-bold text-base">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  WhatsApp Us
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-6 w-6 text-secondary" />
                <span className="font-display font-bold text-lg">Yashshree Classes</span>
              </div>
              <p className="text-sm text-background/60">Shaping futures since 2015. Best coaching classes in Shivane, Pune.</p>
            </div>
            <div>
              <h4 className="font-display font-bold mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm text-background/60">
                <a href="#home" className="block hover:text-secondary transition-colors">Home</a>
                <a href="#courses" className="block hover:text-secondary transition-colors">Courses</a>
                <a href="#features" className="block hover:text-secondary transition-colors">Features</a>
                <a href="#contact" className="block hover:text-secondary transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="font-display font-bold mb-3">Contact</h4>
              <p className="text-sm text-background/60">Kamte Plaza, Jayhind Chowk, Shivane, Pune - 23</p>
              <p className="text-sm text-background/60 mt-2">📞 9405402865 / 9850740805</p>
            </div>
          </div>
          <div className="border-t border-background/10 pt-6 text-center">
            <p className="text-xs text-background/40">© 2026 Yashshree Coaching Classes. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CourseCard({
  title,
  classes,
  icon: Icon,
  subjects,
  color,
  badge,
}: {
  title: string;
  classes: string;
  icon: React.ElementType;
  subjects: string[];
  color: string;
  badge?: string;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm border overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      <div className={`${color} text-primary-foreground p-6`}>
        <Icon className="h-8 w-8 mb-3 text-secondary" />
        <h3 className="font-display font-bold text-xl">{title}</h3>
        <p className="text-primary-foreground/80 text-sm mt-1">Class {classes}</p>
        {badge && (
          <span className="inline-block mt-2 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Subjects</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span key={s} className="text-xs bg-muted px-2.5 py-1 rounded-full text-foreground font-medium">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
