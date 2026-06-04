#[test_only]
module timebox::timebox_tests {

    use sui::clock;
    use sui::test_scenario::{Self as ts, Scenario};
    use std::string;
    use timebox::timebox::{Self, Capsule};

    const OWNER:   address = @0xA;
    const HACKER:  address = @0xB;
    const ONE_DAY_MS:  u64 = 86_400_000;
    const ONE_HOUR_MS: u64 = 3_600_000;

    fun setup(scenario: &mut Scenario): sui::clock::Clock {
        ts::next_tx(scenario, OWNER);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        clock
    }

    #[test]
    fun test_seal_and_is_unlocked() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        // Set clock to t=0
        clock::set_for_testing(&mut clock, 0);

        ts::next_tx(&mut scenario, OWNER);
        {
            let blob_id  = string::utf8(b"test-blob-id-123");
            let unlock   = ONE_DAY_MS; // 24 h from now
            timebox::seal(blob_id, unlock, &clock, ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let capsule = ts::take_from_sender<Capsule>(&scenario);

            // Before unlock time — still locked
            assert!(!timebox::is_unlocked(&capsule, &clock), 0);

            // Advance clock past unlock time
            clock::set_for_testing(&mut clock, ONE_DAY_MS + ONE_HOUR_MS);
            assert!(timebox::is_unlocked(&capsule, &clock), 1);

            ts::return_to_sender(&scenario, capsule);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_reveal_succeeds_after_unlock() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        clock::set_for_testing(&mut clock, 0);

        ts::next_tx(&mut scenario, OWNER);
        {
            let blob_id = string::utf8(b"walrus-blob-abc");
            timebox::seal(blob_id, ONE_DAY_MS, &clock, ts::ctx(&mut scenario));
        };

        // Advance past unlock
        clock::set_for_testing(&mut clock, ONE_DAY_MS + 1);

        ts::next_tx(&mut scenario, OWNER);
        {
            let capsule = ts::take_from_sender<Capsule>(&scenario);
            // Should not abort
            timebox::reveal(&capsule, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, capsule);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = timebox::timebox::E_STILL_LOCKED)]
    fun test_reveal_fails_before_unlock() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        clock::set_for_testing(&mut clock, 0);

        ts::next_tx(&mut scenario, OWNER);
        {
            timebox::seal(string::utf8(b"blob"), ONE_DAY_MS, &clock, ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let capsule = ts::take_from_sender<Capsule>(&scenario);
            // Clock still at 0 — should abort with E_STILL_LOCKED
            timebox::reveal(&capsule, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, capsule);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = timebox::timebox::E_NOT_OWNER)]
    fun test_reveal_fails_for_non_owner() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        clock::set_for_testing(&mut clock, 0);

        ts::next_tx(&mut scenario, OWNER);
        {
            timebox::seal(string::utf8(b"blob"), ONE_DAY_MS, &clock, ts::ctx(&mut scenario));
        };

        clock::set_for_testing(&mut clock, ONE_DAY_MS + 1);

        // Hacker tries to reveal owner's capsule
        ts::next_tx(&mut scenario, HACKER);
        {
            let capsule = ts::take_from_address<Capsule>(&scenario, OWNER);
            timebox::reveal(&capsule, &clock, ts::ctx(&mut scenario));
            ts::return_to_address(OWNER, capsule);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = timebox::timebox::E_UNLOCK_IN_PAST)]
    fun test_seal_fails_with_past_timestamp() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        // Clock at 1 day — trying to seal with unlock in the past
        clock::set_for_testing(&mut clock, ONE_DAY_MS);

        ts::next_tx(&mut scenario, OWNER);
        {
            timebox::seal(string::utf8(b"blob"), ONE_HOUR_MS, &clock, ts::ctx(&mut scenario));
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_burn_by_owner() {
        let mut scenario = ts::begin(OWNER);
        let mut clock    = setup(&mut scenario);

        clock::set_for_testing(&mut clock, 0);

        ts::next_tx(&mut scenario, OWNER);
        {
            timebox::seal(string::utf8(b"blob"), ONE_DAY_MS, &clock, ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, OWNER);
        {
            let capsule = ts::take_from_sender<Capsule>(&scenario);
            timebox::burn(capsule, ts::ctx(&mut scenario));
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
