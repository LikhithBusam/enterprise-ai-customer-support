import { HelpCircle } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { EmptyState } from "@/components/status/empty-state"
import type { FaqEntry } from "@/types/mocked"

interface HelpFaqProps {
  faqs: FaqEntry[]
}

export function HelpFaq({ faqs }: HelpFaqProps) {
  if (faqs.length === 0) {
    return <EmptyState icon={HelpCircle} title="No FAQs match your search" description="Try a different term or clear the category filter." />
  }

  return (
    <Accordion type="multiple" className="rounded-lg border border-border bg-card px-4">
      {faqs.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id}>
          <AccordionTrigger>{faq.question}</AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground">{faq.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
