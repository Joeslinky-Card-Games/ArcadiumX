import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function RulesDialog({
  open,
  onOpenChange,
  onDontShowAgain,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDontShowAgain: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-amber-100">Charlotte's Web — how to play</DialogTitle>
          <DialogDescription>
            A 13-round rummy variant with expanding hands and a rotating wild rank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed text-white/85">
          <section>
            <h3 className="font-semibold text-amber-200">The deck &amp; wilds</h3>
            <p>
              Two 52-card decks plus 4 jokers. Jokers are always wild. Each round has a
              <em> wild rank</em> — every card of that rank can be played as a natural
              of its rank <em>or</em> as a wild card, whichever helps you.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-amber-200">Rounds</h3>
            <p>
              You play 13 rounds. The hand size grows each round and the wild rank rotates:
            </p>
            <ul className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 text-xs text-white/70">
              <li>R1 — 3 cards, wild 3</li>
              <li>R2 — 4 cards, wild 4</li>
              <li>R3 — 5 cards, wild 5</li>
              <li>R4 — 6 cards, wild 6</li>
              <li>R5 — 7 cards, wild 7</li>
              <li>R6 — 8 cards, wild 8</li>
              <li>R7 — 9 cards, wild 9</li>
              <li>R8 — 10 cards, wild 10</li>
              <li>R9 — 11 cards, wild J</li>
              <li>R10 — 12 cards, wild Q</li>
              <li>R11 — 13 cards, wild K</li>
              <li>R12 — 14 cards, wild A</li>
              <li>R13 — 15 cards, wild 2</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-amber-200">Your turn</h3>
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                <strong>Draw</strong> the top card of the stock <em>or</em> take the top
                card from the discard pile.
              </li>
              <li>
                Optionally <strong>lay down</strong> if all your cards fit into valid
                melds, keeping one card to discard.
              </li>
              <li><strong>Discard</strong> one card to end your turn.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-amber-200">Valid melds</h3>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Sets</strong> — 3 or 4 cards of the same rank.
              </li>
              <li>
                <strong>Runs</strong> — 3 or more consecutive cards of the same suit.
                Ace plays low (A-2-3) or high (Q-K-A).
              </li>
              <li>
                A meld must always contain <em>more naturals than wilds</em>.
                Jokers and wild-rank cards count as wilds when used that way.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-amber-200">Going out &amp; scoring</h3>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                The first player to lay down every card into valid melds (with one
                discard) <strong>goes out</strong>. Remaining players each get one
                more turn to reduce their hand.
              </li>
              <li>
                At the end of the round, everyone but the player who went out is
                scored on their unmelded cards: A = 1, 2–9 = face value, 10/J/Q/K =
                10, joker = 50. Lowest total after 13 rounds wins.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-amber-200">Auto-arrange</h3>
            <p>
              The table automatically groups your cards into the best meld
              arrangement so you can see at a glance what's melded and what's
              scoring against you. The <em>Lay down · go out</em> button only
              lights up when a complete lay-down is possible.
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onDontShowAgain}>Don't show again</Button>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}