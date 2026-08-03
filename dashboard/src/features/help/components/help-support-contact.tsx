import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SupportContact } from "@/types/mocked"

interface HelpSupportContactProps {
  contacts: SupportContact[]
}

export function HelpSupportContact({ contacts }: HelpSupportContactProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Support Contact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.map((contact) => (
          <div key={contact.id} className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{contact.channel}</p>
            {contact.url ? (
              <a
                href={contact.url}
                className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {contact.value}
              </a>
            ) : (
              <p className="text-sm font-medium text-foreground">{contact.value}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
