import Image from "next/image";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
});

export function Testimonial() {
  return (
    <section className="py-24 bg-surface">
      <div className="max-w-3xl mx-auto px-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-10">
          Success Stories
        </p>
        <blockquote
          className={`${playfair.className} text-2xl md:text-3xl lg:text-[32px] text-text-black leading-snug mb-10`}
        >
          &ldquo;I used to spend my evenings copy-pasting resumes. Now I open my
          dashboard to see interviews waiting. It feels like cheating. Had 3
          offers on the table simultaneously.&rdquo;
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/images/user-icon.png"
            alt="Tom Wilson"
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="text-left">
            <p className="text-sm font-semibold text-text-primary">Tom Wilson</p>
            <p className="text-sm text-text-secondary">Junior Developer</p>
          </div>
        </div>
      </div>
    </section>
  );
}
