"""Create inactive, verified demo monitors for a user's global status page."""

import argparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--user-email",
        required=True,
        help="Email of the existing account that will own the demo monitors",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of demo monitors to create (1-25, default: 5)",
    )
    args = parser.parse_args()
    if not 1 <= args.count <= 25:
        parser.error("--count must be between 1 and 25")
    return args


def main() -> None:
    args = parse_args()
    email = args.user_email.strip().casefold()
    if not email:
        raise SystemExit("--user-email cannot be empty")

    from app.core.database import SessionLocal
    from app.models import Monitor, User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email.ilike(email)).one_or_none()
        if user is None:
            raise SystemExit(f"No existing user found with email: {email}")

        monitor_names = [f"Demo estado global {index:02d}" for index in range(1, args.count + 1)]
        existing_names = {
            name
            for (name,) in db.query(Monitor.nombre).filter(
                Monitor.user_id == user.id,
                Monitor.nombre.in_(monitor_names),
            )
        }

        created = 0
        for index, name in enumerate(monitor_names, start=1):
            if name in existing_names:
                continue

            db.add(
                Monitor(
                    user_id=user.id,
                    nombre=name,
                    url=f"https://demo-global-{index:02d}.example.invalid",
                    intervalo_segundos=300,
                    activo=False,
                    verified=True,
                    incluido_en_status_personal=False,
                    incluido_en_status_global=True,
                )
            )
            created += 1

        db.commit()
        print(
            f"Created {created} demo monitor(s) for {user.email}; "
            f"{len(existing_names)} matching demo monitor(s) already existed."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
