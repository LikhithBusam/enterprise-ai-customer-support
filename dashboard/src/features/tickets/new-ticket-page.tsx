import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ApiError } from "@/services/client"
import { useSubmitTicket } from "@/features/tickets/hooks"
import { ticketFormSchema, TICKET_INTENT_OPTIONS, type TicketFormValues } from "@/features/tickets/schema"
import type { TicketResponse } from "@/types/api"

function generateTicketId(): string {
  return `TKT-${Date.now().toString(36).toUpperCase()}`
}

/** Maps the real backend's HTTP error surface (src/api/main.py, src/api/auth.py) to a message a
 * support agent submitting a ticket can actually act on — this endpoint is the one place in the
 * dashboard where a failure means "the real backend rejected this," not "the mock server
 * returned canned data." */
function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "This workspace's API key isn't recognized by the backend. Unlike the rest of the dashboard, ticket submission calls the real API — sign in with a key configured in the backend's API_KEYS."
    }
    if (error.status === 429) {
      return "Rate limit exceeded. Wait a moment and try again."
    }
    if (error.status === 502) {
      return "The backend accepted the request but the ticket pipeline failed while processing it. Try again — if it keeps happening, check the backend logs."
    }
    return error.detail || `The backend rejected this request (HTTP ${error.status}).`
  }
  return "Couldn't reach the backend. Confirm it's running (uv run uvicorn src.api.main:app --port 8000) and reachable at the configured API base URL."
}

export function NewTicketPage() {
  const [ticketId, setTicketId] = useState(generateTicketId)
  const [result, setResult] = useState<TicketResponse | null>(null)
  const submitMutation = useSubmitTicket()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: { customer_id: "", customer_message: "", intent_label: "" },
  })

  async function onSubmit(values: TicketFormValues): Promise<void> {
    try {
      const response = await submitMutation.mutateAsync({
        ticket_id: ticketId,
        customer_id: values.customer_id,
        customer_message: values.customer_message,
        intent_label: values.intent_label,
      })
      setResult(response)
    } catch {
      // Surfaced below via submitMutation.isError / submitMutation.error — nothing further to do.
    }
  }

  function handleSubmitAnother(): void {
    setResult(null)
    submitMutation.reset()
    setTicketId(generateTicketId())
    reset({ customer_id: "", customer_message: "", intent_label: "" })
  }

  return (
    <div>
      <PageHeader
        title="New Ticket"
        description="Submit a support ticket to the live multi-agent pipeline — this is the one real backend integration in this dashboard, not a mocked one"
      />
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {result ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {result.resolved ? (
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
                )}
                <CardTitle className="text-base font-medium">
                  {result.resolved ? "Ticket resolved" : result.escalate ? "Ticket escalated" : "Ticket processed"}
                </CardTitle>
              </div>
              <CardDescription>
                {result.ticket_id}
                {result.replayed && " · replayed from a previous identical submission"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={result.resolved ? "secondary" : "outline"}>
                  {result.resolved ? "Resolved" : "Not resolved"}
                </Badge>
                <Badge variant={result.escalate ? "destructive" : "outline"}>
                  {result.escalate ? "Escalated" : "Not escalated"}
                </Badge>
                <Badge variant="outline">{result.memory_hit ? "Memory hit" : "No memory hit"}</Badge>
                <Badge variant="outline">
                  {result.replanning_count} replan{result.replanning_count === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Response</p>
                <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
                  {result.response_message || "(no response message)"}
                </p>
              </div>

              {result.tool_calls_made.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tool calls ({result.tool_calls_made.length})
                  </p>
                  <div className="space-y-1.5">
                    {result.tool_calls_made.map((call, index) => (
                      <div
                        // eslint-disable-next-line react/no-array-index-key -- backend doesn't assign call ids; order is stable within one response
                        key={index}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-mono">{call.tool_name}</span>
                        <Badge variant={call.success ? "secondary" : "destructive"} className="font-normal">
                          {call.success ? "success" : call.failure_type ?? "failed"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSubmitAnother}>
                <RotateCcw className="size-3.5" />
                Submit another ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ticket details</CardTitle>
              <CardDescription>Fields marked required are sent to the backend as-is.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket_id">Ticket ID</Label>
                  <Input
                    id="ticket_id"
                    name="ticket_id"
                    value={ticketId}
                    disabled
                    readOnly
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Generated for you — also the idempotency key, so resubmitting this exact ticket
                    ID replays the same result instead of reprocessing it.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer_id">Customer ID</Label>
                  <Input
                    id="customer_id"
                    autoComplete="off"
                    placeholder="CUST-0042"
                    aria-invalid={Boolean(errors.customer_id)}
                    aria-describedby={errors.customer_id ? "customer_id-error" : undefined}
                    {...register("customer_id")}
                  />
                  {errors.customer_id && (
                    <p id="customer_id-error" role="alert" className="text-xs text-destructive">
                      {errors.customer_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer_message">Customer message</Label>
                  <Textarea
                    id="customer_message"
                    rows={5}
                    placeholder="Describe what the customer needs help with…"
                    aria-invalid={Boolean(errors.customer_message)}
                    aria-describedby={errors.customer_message ? "customer_message-error" : undefined}
                    {...register("customer_message")}
                  />
                  {errors.customer_message && (
                    <p id="customer_message-error" role="alert" className="text-xs text-destructive">
                      {errors.customer_message.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="intent_label">Intent</Label>
                  <Controller
                    control={control}
                    name="intent_label"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} name="intent_label">
                        <SelectTrigger id="intent_label" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_INTENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value || "auto"} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave as Auto-detect to let the Intake agent classify it.
                  </p>
                </div>

                {submitMutation.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {describeSubmitError(submitMutation.error)}
                  </p>
                )}

                <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Submit ticket
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
