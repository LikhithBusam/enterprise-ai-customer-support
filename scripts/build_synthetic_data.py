#!/usr/bin/env python3
"""Generate synthetic customer support ticket dataset with injected tool failures.

Phrasing diversity strategy
----------------------------
Each intent cluster has 50+ distinct template strings.  The templates use
multiple named slots ({order}, {item}, {amount}, etc.) drawn from large
vocabulary pools, so even the same template produces different surface forms
in practice.  A post-generation uniqueness check enforces ≥98% unique
customer_message values before writing the file.
"""

import json
import random
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Vocabulary pools
# ---------------------------------------------------------------------------

ITEMS = [
    "Smart Widget Pro", "USB-C Cable 6ft", "Wireless Mouse M1",
    "Laptop Stand Adjustable", "Mechanical Keyboard K10", "HDMI 2.1 Cable 10ft",
    "Webcam 4K Ultra", "Bluetooth Speaker Mini", "Phone Grip Stand",
    "Desk Organizer Large", "Monitor Light Bar", "Power Bank 20000mAh",
    "Noise Cancelling Earbuds", "Mouse Pad Extended", "Laptop Sleeve 15-inch",
    "Ergonomic Wrist Rest", "Smart LED Strip", "USB Hub 7-Port",
    "Portable SSD 1TB", "Travel Adapter Universal",
]

ORDERS = [f"ORD-{1000 + i}" for i in range(1, 51)]  # 50 order IDs for more variety

AMOUNTS = [
    "$29.99", "$34.50", "$49.99", "$54.00", "$59.50", "$74.99",
    "$79.99", "$89.00", "$99.99", "$109.50", "$124.99", "$139.00",
    "$149.99", "$174.99", "$199.99", "$224.00", "$249.99", "$299.99",
]

EXTRAS = ["$5.00", "$7.50", "$9.99", "$10.00", "$12.50", "$15.99", "$20.00", "$22.00", "$25.50"]

LESS = [
    "$19.99", "$24.99", "$29.00", "$34.99", "$39.99", "$44.50",
    "$49.99", "$54.99", "$59.00", "$64.99", "$69.99", "$79.99", "$89.99",
]

DAYS_AGO   = ["two days ago", "three days ago", "last week", "over a week ago", "almost two weeks ago"]
DAYS_WAIT  = ["3 days", "5 days", "a week", "10 days", "two weeks", "almost three weeks"]
DAYS_LATE  = ["two days", "three days", "a week", "over a week", "nearly two weeks"]
DAYS_REFUND = ["5 business days", "7 days", "10 days", "two weeks", "three weeks"]

# ---------------------------------------------------------------------------
# Intent templates — 50+ per cluster, varied structure/tone/length
# ---------------------------------------------------------------------------

INTENTS: dict[str, dict[str, Any]] = {

    # -----------------------------------------------------------------------
    "refund_request": {
        "tools": ["crm", "order_lookup", "refund"],
        "weight": 40,
        "templates": [
            # Damage / defective
            "I need a refund for order {order}. The {item} arrived damaged.",
            "The {item} I received in order {order} was cracked out of the box. I'd like my money back.",
            "Order {order} — the {item} is defective. Please process a full refund.",
            "Hi, my {item} from order {order} broke after one use. Requesting a refund please.",
            "The {item} in order {order} stopped working within 24 hours. I want a refund.",
            "I just opened order {order} and the {item} has a crack. Can I get a refund?",
            "Defective product alert: the {item} in order {order} doesn't work. Please refund.",
            "The {item} arrived in order {order} with visible damage — I need a full refund.",
            # Not received
            "Can I get my money back for order {order}? I never received it.",
            "Order {order} was never delivered. Please refund {amount}.",
            "I've been waiting {days_late} and order {order} still hasn't arrived. Please refund me.",
            "Where is order {order}? It's been {days_late} and I'd just like a refund at this point.",
            "My package for order {order} is lost. I want a refund, not a replacement.",
            # Wrong item / not as described
            "The {item} I received ({order}) is the wrong color. I want a refund.",
            "I ordered a {item} but received something completely different in order {order}. Refund please.",
            "The {item} from order {order} is nothing like the product photos. I'm requesting a refund.",
            "Order {order} contained the wrong {item}. I don't want an exchange — just a refund.",
            "Hi, the {item} I ordered ({order}) is not what I expected. I'd like a refund please.",
            # Accidental / cancelled
            "Please process a refund for order {order}. I accidentally ordered twice.",
            "Can you cancel order {order} and refund me? It hasn't shipped yet.",
            "I placed order {order} by mistake. Can I cancel it and get a refund?",
            "I meant to order a different size — order {order} needs to be cancelled and refunded.",
            "I want to cancel order {order} immediately and get a full refund.",
            # Quality / doesn't fit
            "I'm not satisfied with the {item} from order {order}. Please refund.",
            "Hi team, requesting a refund for order {order}. The quality is very poor.",
            "The {item} from order {order} doesn't fit at all. I'd like my money back.",
            "Please refund order {order}. The {item} doesn't match the description.",
            "The build quality of the {item} in order {order} is disappointing. Refund requested.",
            # Missing parts
            "My order {order} had missing parts. Refund requested.",
            "The {item} in order {order} arrived without its accessories. I want a refund.",
            "Half the components were missing from order {order}. Please refund.",
            # Gift / late
            "Order {order} was supposed to be a gift but arrived damaged. Full refund please.",
            "Order {order} arrived {days_late} late and the {item} is unusable. Refund please.",
            "The {item} was supposed to arrive before my event but order {order} was {days_late} late. Refund please.",
            # Partial refund
            "Can I get a partial refund for order {order}? The {item} is scratched.",
            "I'd like a partial refund for order {order} since the {item} is slightly damaged.",
            # Unauthorized
            "I never authorized order {order}. Need a refund immediately.",
            "There's an order {order} on my account I didn't place. Please refund {amount}.",
            "Someone made an unauthorized purchase ({order}) on my account. I need that refunded.",
            # Misc formal / informal
            "I'd like to return the {item} from order {order}. Please issue a refund.",
            "I want to return order {order} and get a refund. The item is unopened.",
            "Please refund me for order {order} — the {item} is completely unusable.",
            "Can your team process a refund for order {order}? I'm very unhappy with this purchase.",
            "Refund request: order {order}, {item}, purchased for {amount}. Product is substandard.",
            "Hi, I purchased the {item} via order {order} and it's not fit for purpose. Refund needed.",
            "I received order {order} today and I'd like to initiate a return and get my {amount} back.",
            "Order {order} — {item} not working. Please refund my {amount} at your earliest convenience.",
            "I have been trying to get a refund for order {order} for {days_late}. Please help.",
            "This is my second request for a refund on order {order}. The {item} is broken.",
        ],
    },

    # -----------------------------------------------------------------------
    "order_status": {
        "tools": ["crm", "order_lookup"],
        "weight": 40,
        "templates": [
            # Simple status check
            "Where is my order {order}? It was supposed to arrive yesterday.",
            "Can you check the status of order {order}? Tracking hasn't updated.",
            "Hi, I'm checking on order {order}. When will it be delivered?",
            "What's the current status of order {order}?",
            "Please give me an update on order {order}.",
            "Can you tell me where order {order} is right now?",
            "I'd like a status update on my order {order}, please.",
            "Any news on order {order}? I haven't heard anything.",
            # Delayed / no movement
            "Order {order} — what's the delivery ETA? It's been over a week.",
            "Tracking for order {order} shows no movement in {days_wait}. Can you look into it?",
            "Hi, what's going on with order {order}? No updates in {days_wait}.",
            "Order {order} tracking has been stuck since {days_ago}. Is there an issue?",
            "My tracking link for order {order} hasn't changed in {days_wait}. Please check.",
            "The last scan for order {order} was {days_ago}. Is it lost?",
            "Tracking says 'in transit' for order {order} since {days_ago}. That seems too long.",
            "Order {order} hasn't moved in {days_wait}. Should I be worried?",
            # Shipping confirmation
            "Has order {order} shipped yet? I need it by Friday.",
            "Has order {order} left the warehouse yet?",
            "Can you confirm order {order} has been dispatched?",
            "I placed order {order} {days_ago} — has it shipped?",
            "I was expecting a shipping confirmation for order {order} but received nothing.",
            "Did order {order} ship? I haven't received a tracking number.",
            # Specific concern
            "I placed order {order} last week. Any updates on delivery?",
            "Where is my package? Order {order} shows 'in transit' but no location.",
            "Order {order} is late. When should I expect it?",
            "I need an update on order {order}. Is it still on track for delivery?",
            "Please check the shipping status for order {order}.",
            "Order {order} delivery date was missed. Any news?",
            "I'm worried about order {order} — tracking shows 'delayed'.",
            "When will order {order} arrive? It's a gift for this weekend.",
            "Can you provide a tracking update for order {order}?",
            "Order {order} status please. The last update was {days_ago}.",
            "Hi, my order {order} shows 'pending'. Is there a problem?",
            # Tone variation
            "Hello, I've been waiting on order {order} for {days_wait}. Can someone please help?",
            "Hey, just wondering about order {order}. Any idea when it'll arrive?",
            "Good morning! Could you check on the status of order {order} for me?",
            "Just following up on order {order} which I placed {days_ago}.",
            "I need to know where order {order} is ASAP. It's urgent.",
            "Order {order} is showing as delayed. What are my options?",
            "Can you escalate the tracking issue on order {order}? It's been {days_wait}.",
            "I ordered {days_ago} and still nothing. Can you track down order {order}?",
            "My order {order} was supposed to arrive {days_late} ago. What happened?",
            "Hey team, order {order} is MIA. Can you check the carrier?",
            "Any idea why order {order} is taking so long? Standard shipping estimate was missed.",
            "Order {order} says 'out for delivery' since {days_ago}. Still not here.",
            "The courier for order {order} apparently attempted delivery but I was home. Please help.",
            "I need a delivery window for order {order}. Can you check with the courier?",
            "Order {order} is showing a customs hold. What do I do?",
        ],
    },

    # -----------------------------------------------------------------------
    "billing_dispute": {
        "tools": ["crm", "order_lookup", "kb_search", "refund"],
        "weight": 35,
        "templates": [
            # Overcharge
            "I was charged {amount} for order {order} but the total was supposed to be {less}. Please fix.",
            "Hi, I was overcharged {extra} on order {order}. Please refund the difference.",
            "The price at checkout was {less} but I was billed {amount} for order {order}.",
            "My invoice for order {order} shows {amount} but the agreed price was {less}.",
            "There's a {extra} discrepancy on order {order} — I was billed {amount} instead of {less}.",
            "I'm being charged {amount} for order {order} but your website shows {less}. Please correct.",
            "The price on the product page was {less} but checkout was {amount} for order {order}.",
            "I have a promo code that should have reduced order {order} to {less}, but I was charged {amount}.",
            # Double charge
            "There's a double charge on my account for order {order}. I need it reversed.",
            "I was charged twice for the same order {order}. Cancel one charge.",
            "My bank statement shows two charges of {amount} for order {order}. One needs to be reversed.",
            "I see duplicate charges for order {order}. Please investigate.",
            # Unauthorized
            "My credit card was charged {amount} but I never placed order {order}.",
            "My statement shows a charge from your company for {amount} — I don't recognize order {order}.",
            "I'm disputing the charge of {amount} for order {order}. I didn't authorize this.",
            "There's a charge on my card for {amount} related to order {order} that I didn't make.",
            # Pending / unrecognized
            "I see a pending charge for order {order} that doesn't match my receipt.",
            "A charge of {amount} appeared on my account for order {order} after I cancelled.",
            "My card was charged {amount} for order {order} even though the order failed.",
            # Promo / discount not applied
            "Billing issue: order {order} shows {amount} but I have a promo code for {less}.",
            "Hi, my order {order} was supposed to be {less} with the discount but I paid {amount}.",
            "My loyalty discount wasn't applied to order {order}. I should have paid {less} not {amount}.",
            "I was promised a 20% discount but order {order} was charged at full price ({amount}).",
            # Shipping overcharge
            "You charged me shipping but I have free shipping on order {order}.",
            "I was charged {extra} in shipping fees for order {order} that were supposed to be waived.",
            # Subscription / recurring
            "The subscription fee went up without notice. Can you check?",
            "I was charged {amount} for a subscription renewal I cancelled {days_ago}.",
            "My subscription shouldn't have renewed — I cancelled order {order} {days_ago}.",
            # Refund not received
            "I returned order {order} but never got the refund. It's been {days_wait}.",
            "The refund for order {order} of {amount} still hasn't appeared after {days_refund}.",
            "I was told the refund for order {order} would arrive in {days_refund}. Still waiting.",
            "Where is my refund for order {order}? I returned it {days_ago}.",
            # Billing address / card issues
            "The billing address on order {order} is wrong and the charge was declined but retried.",
            "My payment method was charged for order {order} after I updated my card.",
            # Currency / conversion
            "There's a currency conversion fee on order {order} I didn't agree to.",
            "I was charged in USD but I live in Canada — unexpected conversion fees on order {order}.",
            # Cancelled but still charged
            "I cancelled before shipping but still got charged for order {order}.",
            "I cancelled order {order} within 10 minutes but {amount} was still taken from my account.",
            # Item not arrived but charged
            "I'm disputing the charge for order {order}. The item never arrived.",
            "I paid {amount} for order {order} and it never arrived. I want my money back.",
            # Misc
            "Hi, the invoice for order {order} doesn't add up. I was overcharged.",
            "Could you please audit the charges on order {order}? Something doesn't look right.",
            "The tax charged on order {order} seems way too high. Please review.",
            "I received a partial shipment for order {order} but was charged the full {amount}.",
            "Only half my order arrived but I was charged {amount} in full for order {order}.",
            "Order {order} was supposed to bundle a {item} for free but I was charged {extra} for it.",
            "I need a detailed receipt for order {order}. The summary charge of {amount} is unexplained.",
        ],
    },

    # -----------------------------------------------------------------------
    "account_issue": {
        "tools": ["crm", "kb_search"],
        "weight": 35,
        "templates": [
            # Login / password
            "I can't log into my account. It says 'email not found'.",
            "I forgot my password and the reset link isn't arriving in my inbox.",
            "The password reset email isn't coming through. I've checked spam.",
            "I keep getting 'incorrect password' even after resetting it.",
            "My account appears to be locked after too many login attempts.",
            "I've been locked out of my account. How do I get back in?",
            "I can't sign in — it says my account doesn't exist even though I've been a customer for years.",
            "My login credentials stopped working overnight. Please help.",
            "I reset my password but the new one still doesn't work.",
            "I'm getting a 'session expired' error every few minutes. Very frustrating.",
            # Email / contact info
            "Can you update my email address on file? I changed jobs.",
            "I need to change the email on my account to my new address.",
            "I no longer have access to the email I used to sign up. Can you update it?",
            "My old email was deactivated. How do I update my account email?",
            "I'm not receiving any order confirmation emails anymore.",
            "Emails from your service are going to my spam. Can you whitelist help?",
            "The account verification email never arrives. I've checked spam.",
            "I never received the welcome email after signing up. Is my account active?",
            # Security concerns
            "Someone changed my account password without permission.",
            "There's an unknown device logged into my account. Please check.",
            "I see another user's orders in my account history. Privacy concern!",
            "My account was accessed from a location I don't recognize.",
            "I think my account was hacked. Please help me secure it.",
            "I received a password changed notification I didn't trigger.",
            # Profile / settings
            "My shipping address is outdated in my profile. Can you update it?",
            "I need to update my phone number on the account.",
            "I can't change my profile picture or bio. The save button does nothing.",
            "My payment method expired and I can't update it in settings.",
            "The address book in my account only shows old addresses.",
            "How do I add a secondary email for notifications?",
            # Plan / tier
            "I upgraded my plan but my account still shows the old tier.",
            "My account shows the wrong subscription plan. I'm on premium, not basic.",
            "I downgraded my account but I'm still being billed at the premium rate.",
            # Account management
            "How do I delete my account? Please assist.",
            "I want to permanently close my account and delete all my data.",
            "I need to merge two accounts I accidentally created.",
            "I created a duplicate account — can you merge it with my original one?",
            "How do I download all my data from your platform?",
            "I want a copy of my personal data under GDPR. How do I request it?",
            # 2FA
            "The two-factor authentication code isn't being sent to my phone.",
            "I got a new phone and can't receive the 2FA code anymore.",
            "My 2FA app was lost with my old phone. How do I reset it?",
            # Recovery
            "Can you help me recover my account? I don't remember the email I used.",
            "I can't remember the email or username I signed up with.",
            # SSO / social login
            "I created an account with my Google login but can't sign in with email.",
            "I signed up with Facebook but Facebook login is now broken on your site.",
            "My Apple ID login stopped working on your platform.",
            # Misc
            "My account dashboard shows blank orders even though I've ordered before.",
            "The order history in my account is missing some past orders.",
            "My account preferences keep resetting every time I log out.",
            "I'm unable to add a second delivery address to my account.",
        ],
    },

    # -----------------------------------------------------------------------
    "complaint_escalation": {
        "tools": ["crm", "order_lookup", "kb_search"],
        "weight": 30,
        "templates": [
            # Repeated contact
            "This is the third time I'm contacting about order {order}. I want to speak to a manager.",
            "I've reached out four times about order {order} and nothing has been resolved. Escalate please.",
            "I've been contacting support about order {order} for {days_wait} with no resolution.",
            "This is my second escalation for order {order}. Please get a senior agent involved.",
            "I've filed {days_wait} worth of follow-ups on order {order}. Still unresolved.",
            "I've sent three emails about order {order} and received only automated replies.",
            # Disappointment / anger
            "I'm extremely disappointed with the service on order {order}. Escalate this please.",
            "The handling of order {order} has been completely unacceptable. I want this escalated.",
            "I am beyond frustrated with how order {order} has been managed. Please escalate.",
            "Your customer service for order {order} has been appalling. I need a supervisor.",
            "I am furious about order {order}. This has gone on long enough.",
            # Wrong info given
            "Your support team gave me wrong info about order {order}. I need a supervisor.",
            "I was told order {order} would be resolved by now. That was a lie. Escalate.",
            "An agent told me the refund for order {order} was processed. It wasn't.",
            "I was given incorrect tracking info for order {order} by your last agent.",
            # Delayed resolution
            "I've been waiting {days_wait} for a resolution on order {order}. Escalating now.",
            "The refund for order {order} was supposed to take {days_refund}. It's been {days_wait}. Escalate!",
            "Order {order} has been 'under investigation' for {days_wait}. I need an update today.",
            "It's been {days_wait} since I first complained about order {order}. Still nothing.",
            # Formal complaint
            "I'm filing a formal complaint about the handling of order {order}.",
            "I want to formally document my dissatisfaction with order {order}.",
            "Please log this as an official complaint regarding order {order}.",
            "I'm requesting written confirmation of my complaint about order {order}.",
            "I need a written response about the handling of order {order} for my records.",
            # Requesting human
            "Your chatbot couldn't help me. I need a human agent for order {order}.",
            "I've been bounced around automated systems. I need a real person for order {order}.",
            "Please connect me to a live agent about order {order}. This is urgent.",
            # Promised callback
            "I was promised a callback about order {order} {days_ago}. Nothing. Escalate.",
            "I requested a supervisor callback for order {order} {days_ago} and no one called.",
            # Rude agent
            "The agent I spoke to was rude about order {order}. I want to escalate.",
            "The last support rep was dismissive and unhelpful about order {order}.",
            # Passed around departments
            "My issue with order {order} has been passed around four departments. Please escalate.",
            "I've been transferred five times about order {order}. No one helps.",
            "Every department I reach for order {order} sends me to another. I need one owner.",
            # Social media / chargeback threats
            "I'm taking this to social media if order {order} isn't resolved today.",
            "I'll file a chargeback with my bank for order {order} if this isn't fixed immediately.",
            "This is my final attempt to resolve order {order} before I file a chargeback.",
            "I'm about to leave a public review about the way order {order} was handled.",
            # Compensation / insulting offer
            "The compensation offered for order {order} is insulting. I want a supervisor.",
            "You offered me a {extra} voucher for all the trouble with order {order}. That's not enough.",
            # Lost / no responsibility
            "Your company lost my order {order} and refuses to take responsibility. Escalate.",
            "No one is taking ownership of the lost delivery for order {order}.",
            # Damaged item not collected
            "The damaged item from order {order} was never collected despite {days_wait} of requests.",
            "I've been waiting {days_wait} for someone to pick up the defective item from order {order}.",
            # Escalation process broken
            "Your escalation process is broken. I've been stuck in a loop for order {order}.",
            "Every time I ask to escalate order {order}, I'm sent back to the same queue.",
            "I want to speak to the highest available manager about order {order}.",
            "Please assign a dedicated case manager to order {order} immediately.",
            "Your SLA for escalations is clearly not being met for order {order}.",
        ],
    },

    # -----------------------------------------------------------------------
    "general_inquiry": {
        "tools": ["kb_search"],
        "weight": 20,
        "templates": [
            # Hours / contact
            "What are your business hours for customer support?",
            "When is your support team available? I keep missing them.",
            "Do you have 24/7 support or only business hours?",
            "What's the best way to reach your team quickly?",
            "Is there a phone number I can call for support?",
            # Shipping
            "Do you ship internationally? What are the rates?",
            "Which countries do you ship to?",
            "How long does standard shipping typically take?",
            "Is express shipping available and how much does it cost?",
            "Can I schedule a delivery window instead of standard shipping?",
            "Do you ship to PO boxes?",
            "What courier do you use for deliveries?",
            "How are fragile items packaged for shipping?",
            # Returns / policy
            "What is your return policy? How many days do I have?",
            "Can I return an item without the original packaging?",
            "Do I have to pay for return shipping?",
            "What items are non-returnable?",
            "How long does it take to process an exchange?",
            "Can I exchange instead of returning?",
            # Order changes
            "Can I change my order after it's been placed?",
            "Can I add items to an existing order before it ships?",
            "Is it possible to change the delivery address after ordering?",
            # Payment
            "What payment methods do you accept?",
            "Do you accept PayPal or Klarna?",
            "Can I pay using cryptocurrency?",
            "Is it safe to save my card details on your platform?",
            "Do you offer buy-now-pay-later options?",
            # Price / discounts
            "Do you price match if I find a lower price elsewhere?",
            "Do you have a military or student discount?",
            "Do you offer bulk discounts for business purchases?",
            "Are there any seasonal sales coming up?",
            "Is there a referral program or loyalty rewards?",
            # Warranty / guarantee
            "Is there a warranty on your products?",
            "What does the warranty cover exactly?",
            "How do I register my product for warranty?",
            "Are your products covered by a satisfaction guarantee?",
            "What happens if a product fails outside the warranty period?",
            # Tracking / account-free
            "How do I track my order without an account?",
            "Can I check order status using just my email?",
            # Plans / products
            "What's the difference between the basic and premium plans?",
            "Can you send me a catalog of your products?",
            "Do you have a size guide for your products?",
            "What size guide should I use for your clothing line?",
            # Gift cards / subscriptions
            "Can I buy a gift card on your website?",
            "Do gift cards expire?",
            "How do I redeem a gift card at checkout?",
            # Marketing
            "How do I unsubscribe from marketing emails?",
            "Can I opt out of SMS notifications?",
            "Why am I still getting emails after unsubscribing?",
            # Misc
            "Is your platform accessible for users with disabilities?",
            "Do you have a mobile app?",
            "How do I leave a review for a product I purchased?",
            "Do you have a community forum or help center?",
        ],
    },
}

# ---------------------------------------------------------------------------
# Edge-case templates — harder tickets that test robustness
# ---------------------------------------------------------------------------

EDGE_CASES: list[dict[str, Any]] = [
    # --- Missing entities: no order ID or customer ID mentioned ---
    {
        "template": "I want a refund. The product was broken when it arrived.",
        "intent_label": "refund_request",
        "expected_tool_sequence": ["crm", "order_lookup", "refund"],
        "edge_type": "missing_entity",
    },
    {
        "template": "I need help with my order. It hasn't arrived yet.",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "missing_entity",
    },
    {
        "template": "Why was I charged? I didn't buy anything recently.",
        "intent_label": "billing_dispute",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search", "refund"],
        "edge_type": "missing_entity",
    },
    {
        "template": "I returned something a while ago and still haven't been refunded.",
        "intent_label": "refund_request",
        "expected_tool_sequence": ["crm", "order_lookup", "refund"],
        "edge_type": "missing_entity",
    },
    {
        "template": "My account isn't working properly. I can't see my recent purchases.",
        "intent_label": "account_issue",
        "expected_tool_sequence": ["crm", "kb_search"],
        "edge_type": "missing_entity",
    },
    # --- Multi-intent: customer has two separate concerns ---
    {
        "template": "I need a refund for order {order} AND I can't log into my account anymore.",
        "intent_label": "refund_request",
        "expected_tool_sequence": ["crm", "order_lookup", "refund"],
        "edge_type": "multi_intent",
    },
    {
        "template": "Where is order {order}? Also, can you update the email on my account?",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "multi_intent",
    },
    {
        "template": "I was overcharged on order {order} and my password reset isn't working either.",
        "intent_label": "billing_dispute",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search", "refund"],
        "edge_type": "multi_intent",
    },
    {
        "template": "Please check order {order} status. Also, I want to escalate my previous complaint.",
        "intent_label": "complaint_escalation",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search"],
        "edge_type": "multi_intent",
    },
    {
        "template": "I need to update my shipping address AND get a refund for the {item} in order {order}.",
        "intent_label": "refund_request",
        "expected_tool_sequence": ["crm", "order_lookup", "refund"],
        "edge_type": "multi_intent",
    },
    # --- Contradictory information ---
    {
        "template": "Order {order} shows delivered but I never received it. The tracking says it's still in transit.",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "contradictory",
    },
    {
        "template": "I was charged {amount} for order {order} but the receipt says {less}. The agent said both are correct.",
        "intent_label": "billing_dispute",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search", "refund"],
        "edge_type": "contradictory",
    },
    {
        "template": "Your site says order {order} was refunded but my bank shows the charge is still there after {days_refund}.",
        "intent_label": "billing_dispute",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search", "refund"],
        "edge_type": "contradictory",
    },
    {
        "template": "The agent told me the {item} is in stock but the website says it's out of stock for order {order}.",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "contradictory",
    },
    {
        "template": "I returned the {item} and have the tracking proof but your system says return not received for order {order}.",
        "intent_label": "refund_request",
        "expected_tool_sequence": ["crm", "order_lookup", "refund"],
        "edge_type": "contradictory",
    },
    # --- Ambiguous intent: unclear what the customer actually wants ---
    {
        "template": "Something is wrong with my order {order}.",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "ambiguous",
    },
    {
        "template": "I'm not happy with the {item} I received in order {order}.",
        "intent_label": "complaint_escalation",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search"],
        "edge_type": "ambiguous",
    },
    {
        "template": "I have a problem with order {order}. Can someone help?",
        "intent_label": "order_status",
        "expected_tool_sequence": ["crm", "order_lookup"],
        "edge_type": "ambiguous",
    },
    {
        "template": "This isn't right. Order {order}.",
        "intent_label": "complaint_escalation",
        "expected_tool_sequence": ["crm", "order_lookup", "kb_search"],
        "edge_type": "ambiguous",
    },
    {
        "template": "I need help with my account and an order. Things are messed up.",
        "intent_label": "account_issue",
        "expected_tool_sequence": ["crm", "kb_search"],
        "edge_type": "ambiguous",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pick(seq: list, rng: random.Random):  # type: ignore[type-arg]
    return rng.choice(seq)


def _build_message(template: str, rng: random.Random) -> str:
    subs = {
        "order":      _pick(ORDERS, rng),
        "item":       _pick(ITEMS, rng),
        "amount":     _pick(AMOUNTS, rng),
        "extra":      _pick(EXTRAS, rng),
        "less":       _pick(LESS, rng),
        "days_ago":   _pick(DAYS_AGO, rng),
        "days_wait":  _pick(DAYS_WAIT, rng),
        "days_late":  _pick(DAYS_LATE, rng),
        "days_refund": _pick(DAYS_REFUND, rng),
    }
    return template.format(**subs)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Generate synthetic tickets.")
    parser.add_argument(
        "--v2", action="store_true",
        help="Output to synthetic_tickets_v2.jsonl with edge cases.",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for reproducibility.",
    )
    args = parser.parse_args()

    rng = random.Random(args.seed)

    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)

    tickets: list[dict[str, Any]] = []
    ticket_counter = 0

    if args.v2:
        # Reserve space for edge cases: reduce standard weights proportionally.
        n_edge = len(EDGE_CASES)
        total_standard = 200 - n_edge  # 180 standard tickets
        total_weight = sum(cfg["weight"] for cfg in INTENTS.values())
        adjusted_weights = {
            name: max(1, round(cfg["weight"] / total_weight * total_standard))
            for name, cfg in INTENTS.items()
        }
        # Adjust rounding to hit exactly total_standard.
        diff = total_standard - sum(adjusted_weights.values())
        if diff != 0:
            # Add/remove from the largest cluster.
            largest = max(adjusted_weights, key=adjusted_weights.get)  # type: ignore[arg-type]
            adjusted_weights[largest] += diff
    else:
        adjusted_weights = {name: cfg["weight"] for name, cfg in INTENTS.items()}

    for intent_name, intent_cfg in INTENTS.items():
        n = adjusted_weights[intent_name]
        templates = intent_cfg["templates"]
        if n <= len(templates):
            chosen = rng.sample(templates, n)
        else:
            chosen = list(templates)
            rng.shuffle(chosen)
            while len(chosen) < n:
                chosen.append(_pick(templates, rng))

        for template in chosen:
            ticket_counter += 1
            ticket_id = f"TKT-{ticket_counter:04d}"
            message = _build_message(template, rng)
            ticket_data: dict[str, Any] = {
                "ticket_id": ticket_id,
                "customer_message": message,
                "intent_label": intent_name,
                "expected_tool_sequence": list(intent_cfg["tools"]),
            }
            if args.v2:
                ticket_data["edge_type"] = "standard"
            tickets.append(ticket_data)

    # Add edge-case tickets (v2 only).
    if args.v2:
        for edge in EDGE_CASES:
            ticket_counter += 1
            ticket_id = f"TKT-{ticket_counter:04d}"
            message = _build_message(edge["template"], rng)
            tickets.append({
                "ticket_id": ticket_id,
                "customer_message": message,
                "intent_label": edge["intent_label"],
                "expected_tool_sequence": list(edge["expected_tool_sequence"]),
                "edge_type": edge["edge_type"],
            })

    rng.shuffle(tickets)

    for i, ticket in enumerate(tickets):
        ticket["customer_id"] = f"CUST-{i + 1:04d}"

    # Uniqueness check.
    messages = [t["customer_message"] for t in tickets]
    unique_ratio = len(set(messages)) / len(messages)
    if unique_ratio < 0.98:
        raise RuntimeError(
            f"Only {unique_ratio:.1%} unique messages — add more templates or vocabulary."
        )

    filename = "synthetic_tickets_v2.jsonl" if args.v2 else "synthetic_tickets.jsonl"
    out_path = data_dir / filename
    with out_path.open("w") as f:
        for ticket in tickets:
            f.write(json.dumps(ticket, ensure_ascii=False) + "\n")

    print(f"Generated {len(tickets)} tickets → {out_path}")
    print(f"Unique messages: {len(set(messages))}/{len(messages)} ({unique_ratio:.1%})")
    for intent_name in INTENTS:
        count = sum(1 for t in tickets if t["intent_label"] == intent_name)
        print(f"  {intent_name}: {count}")
    if args.v2:
        from collections import Counter
        edge_counts = Counter(t.get("edge_type", "standard") for t in tickets)
        print(f"\nEdge-case distribution:")
        for etype, cnt in sorted(edge_counts.items()):
            print(f"  {etype}: {cnt}")



if __name__ == "__main__":
    main()
