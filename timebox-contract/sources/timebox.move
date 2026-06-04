/// TimeBox — decentralized time-locked capsule on Sui + Walrus
///
/// Flow:
///   1. Caller encrypts their message off-chain and uploads the ciphertext to
///      Walrus, receiving a blob_id.
///   2. Caller calls `seal(blob_id, unlock_timestamp_ms)` — a Capsule object is
///      created and transferred to their wallet.
///   3. On reveal day the caller (or anyone) calls `assert_unlocked` to confirm
///      the time-lock has passed; the frontend then fetches the blob from Walrus
///      and decrypts it with the key the owner stored locally.
///   4. The owner can `burn` the capsule once they are done with it.
///
/// The encryption key never touches the chain — only the Walrus blob_id and the
/// unlock timestamp are stored.  The time-lock is enforced by the Sui clock so
/// no centralised server can override it.

module timebox::timebox {

    use sui::clock::{Self, Clock};
    use sui::event;
    use std::string::String;

    // ── Error codes ────────────────────────────────────────────────────────────
    const E_UNLOCK_IN_PAST:  u64 = 1; // unlock_timestamp_ms must be in the future
    const E_STILL_LOCKED:    u64 = 2; // reveal called before unlock time
    const E_NOT_OWNER:       u64 = 3; // caller is not the capsule owner

    // ── Core object ───────────────────────────────────────────────────────────
    public struct Capsule has key, store {
        id:                  UID,
        /// Walrus blob ID — points to the encrypted ciphertext
        blob_id:             String,
        /// Unix timestamp in milliseconds after which the capsule is revealed
        unlock_timestamp_ms: u64,
        /// Original sealer — only they can call reveal / burn
        owner:               address,
        /// When the capsule was created (ms)
        created_at_ms:       u64,
    }

    // ── Events ────────────────────────────────────────────────────────────────
    public struct CapsuleSealed has copy, drop {
        capsule_id:          ID,
        owner:               address,
        blob_id:             String,
        unlock_timestamp_ms: u64,
        created_at_ms:       u64,
    }

    public struct CapsuleRevealed has copy, drop {
        capsule_id: ID,
        owner:      address,
        blob_id:    String,
        revealed_at_ms: u64,
    }

    public struct CapsuleBurned has copy, drop {
        capsule_id: ID,
        owner:      address,
    }

    // ── Entry functions ────────────────────────────────────────────────────────

    /// Seal a new time-locked capsule.
    /// `blob_id`             — Walrus blob ID of the encrypted payload
    /// `unlock_timestamp_ms` — epoch milliseconds when the capsule becomes readable
    public entry fun seal(
        blob_id:             String,
        unlock_timestamp_ms: u64,
        clock:               &Clock,
        ctx:                 &mut TxContext,
    ) {
        let now    = clock::timestamp_ms(clock);
        let sender = ctx.sender();

        assert!(unlock_timestamp_ms > now, E_UNLOCK_IN_PAST);

        let capsule = Capsule {
            id:                  object::new(ctx),
            blob_id,
            unlock_timestamp_ms,
            owner:               sender,
            created_at_ms:       now,
        };

        event::emit(CapsuleSealed {
            capsule_id:          object::id(&capsule),
            owner:               sender,
            blob_id:             capsule.blob_id,
            unlock_timestamp_ms,
            created_at_ms:       now,
        });

        transfer::transfer(capsule, sender);
    }

    /// Verify the capsule is unlocked and emit a CapsuleRevealed event.
    /// The frontend listens for this event to confirm the on-chain check passed,
    /// then fetches and decrypts the Walrus blob locally.
    public entry fun reveal(
        capsule: &Capsule,
        clock:   &Clock,
        ctx:     &TxContext,
    ) {
        let now = clock::timestamp_ms(clock);

        assert!(now >= capsule.unlock_timestamp_ms, E_STILL_LOCKED);
        assert!(ctx.sender() == capsule.owner, E_NOT_OWNER);

        event::emit(CapsuleRevealed {
            capsule_id:     object::id(capsule),
            owner:          capsule.owner,
            blob_id:        capsule.blob_id,
            revealed_at_ms: now,
        });
    }

    /// Permanently delete the capsule.
    public entry fun burn(
        capsule: Capsule,
        ctx:     &TxContext,
    ) {
        assert!(ctx.sender() == capsule.owner, E_NOT_OWNER);

        event::emit(CapsuleBurned {
            capsule_id: object::id(&capsule),
            owner:      capsule.owner,
        });

        let Capsule { id, blob_id: _, unlock_timestamp_ms: _, owner: _, created_at_ms: _ } = capsule;
        object::delete(id);
    }

    // ── Read-only helpers ──────────────────────────────────────────────────────

    public fun is_unlocked(capsule: &Capsule, clock: &Clock): bool {
        clock::timestamp_ms(clock) >= capsule.unlock_timestamp_ms
    }

    public fun blob_id(capsule: &Capsule): &String             { &capsule.blob_id }
    public fun unlock_timestamp_ms(capsule: &Capsule): u64     { capsule.unlock_timestamp_ms }
    public fun owner(capsule: &Capsule): address               { capsule.owner }
    public fun created_at_ms(capsule: &Capsule): u64           { capsule.created_at_ms }
}
